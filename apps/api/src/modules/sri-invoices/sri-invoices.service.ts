import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Prisma } from '../../generated/prisma/client';
import {
  PaymentStatus,
  SriInvoiceStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CLINIC_SETTINGS_KEY,
  ClinicSettings,
  mergeClinicSettings,
} from '../settings/settings-defaults';

const sriInvoiceInclude = {
  payment: {
    select: {
      id: true,
      invoiceNumber: true,
      amount: true,
      status: true,
      createdAt: true,
    },
  },
  issuedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.SriInvoiceInclude;

type SriInvoicePayload = Prisma.SriInvoiceGetPayload<{
  include: typeof sriInvoiceInclude;
}>;

type SriInvoiceXmlPayload = Prisma.SriInvoiceGetPayload<{
  include: {
    issuedBy: typeof sriInvoiceInclude.issuedBy;
    payment: {
      include: {
        owner: true;
        items: {
          include: {
            product: {
              select: {
                sku: true;
                name: true;
              };
            };
          };
        };
      };
    };
  };
}>;

@Injectable()
export class SriInvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByPayment(paymentId: string) {
    const invoice = await this.prisma.sriInvoice.findUnique({
      where: { paymentId },
      include: sriInvoiceInclude,
    });
    return invoice ? this.response(invoice) : null;
  }

  async createFromPayment(actorId: string, paymentId: string) {
    const existing = await this.prisma.sriInvoice.findUnique({
      where: { paymentId },
      include: sriInvoiceInclude,
    });
    if (existing) {
      return this.response(existing);
    }

    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, deletedAt: null },
      include: {
        owner: {
          select: {
            firstName: true,
            lastName: true,
            nationalId: true,
            email: true,
          },
        },
      },
    });
    if (!payment) {
      throw new NotFoundException('El cobro no existe');
    }
    if (payment.status === PaymentStatus.VOIDED) {
      throw new BadRequestException('No se puede facturar un cobro anulado');
    }

    const clinic = await this.getClinicSettings();
    this.validateSriSettings(clinic);
    const sequential = await this.nextSequential(clinic.sri.sequential);
    const customerDocument =
      payment.walkInCustomerDocument ||
      payment.owner.nationalId ||
      '9999999999999';
    const created = await this.prisma.sriInvoice.create({
      data: {
        paymentId,
        issuedById: actorId,
        sequential,
        environment: clinic.sri.environment,
        establishmentCode: clinic.sri.establishmentCode,
        emissionPoint: clinic.sri.emissionPoint,
        accessKey: this.demoAccessKey(
          clinic.taxId,
          customerDocument,
          clinic.sri.establishmentCode,
          clinic.sri.emissionPoint,
          sequential,
        ),
        customerName:
          payment.walkInCustomerName ||
          `${payment.owner.firstName} ${payment.owner.lastName}`,
        customerDocument,
        customerEmail: payment.owner.email,
        status: SriInvoiceStatus.DRAFT,
        sriMessage:
          'Demo local: factura creada como borrador. No enviada al SRI.',
      },
      include: sriInvoiceInclude,
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'CREATE',
        entityType: 'SriInvoice',
        entityId: created.id,
        changes: {
          paymentId,
          accessKey: created.accessKey,
          status: created.status,
        },
      },
    });

    return this.response(created);
  }

  async demoAuthorize(sriInvoiceId: string) {
    const invoice = await this.prisma.sriInvoice.findUnique({
      where: { id: sriInvoiceId },
      include: sriInvoiceInclude,
    });
    if (!invoice) {
      throw new NotFoundException('La factura SRI no existe');
    }
    if (invoice.status === SriInvoiceStatus.CANCELLED) {
      throw new BadRequestException('La factura SRI esta cancelada');
    }
    if (!invoice.xmlPath) {
      throw new BadRequestException(
        'Primero genera el XML antes de simular la autorizacion SRI',
      );
    }

    const authorized = await this.prisma.sriInvoice.update({
      where: { id: sriInvoiceId },
      data: {
        status: SriInvoiceStatus.AUTHORIZED,
        authorizationNumber: `DEMO-${invoice.accessKey.slice(-16)}`,
        authorizedAt: new Date(),
        ridePath: `C:/VetCarePro/sri/ride/${invoice.accessKey}.pdf`,
        sriMessage:
          'Autorizacion simulada. Pendiente integracion real con servicios SRI.',
      },
      include: sriInvoiceInclude,
    });

    return this.response(authorized);
  }

  async generateXml(sriInvoiceId: string) {
    const invoice = await this.prisma.sriInvoice.findUnique({
      where: { id: sriInvoiceId },
      include: {
        issuedBy: sriInvoiceInclude.issuedBy,
        payment: {
          include: {
            owner: true,
            items: {
              include: {
                product: {
                  select: {
                    sku: true,
                    name: true,
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('La factura SRI no existe');
    }
    if (invoice.status === SriInvoiceStatus.CANCELLED) {
      throw new BadRequestException('La factura SRI esta cancelada');
    }
    if (invoice.status === SriInvoiceStatus.AUTHORIZED) {
      throw new BadRequestException('La factura SRI ya fue autorizada');
    }

    const clinic = await this.getClinicSettings();
    this.validateSriSettings(clinic);

    const xml = this.buildSriInvoiceXml(invoice, clinic);
    const xmlPath = await this.writeInvoiceXml(invoice.accessKey, xml);
    const updated = await this.prisma.sriInvoice.update({
      where: { id: sriInvoiceId },
      data: {
        status: SriInvoiceStatus.XML_GENERATED,
        xmlPath,
        sriMessage:
          'XML generado localmente. Pendiente firma electronica y envio al SRI.',
      },
      include: sriInvoiceInclude,
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: invoice.issuedById,
        action: 'UPDATE',
        entityType: 'SriInvoice',
        entityId: invoice.id,
        changes: {
          status: SriInvoiceStatus.XML_GENERATED,
          xmlPath,
        },
      },
    });

    return this.response(updated);
  }

  private buildSriInvoiceXml(
    invoice: SriInvoiceXmlPayload,
    clinic: ClinicSettings,
  ) {
    const payment = invoice.payment;
    const issueDate = this.formatSriDate(new Date());
    const totalWithoutTaxes = this.money(payment.subtotal);
    const totalDiscount = this.money(payment.discount);
    const totalAmount = this.money(payment.amount);
    const customerDocument = invoice.customerDocument.replace(/\D/g, '');
    const customerIdType = this.customerIdentificationType(customerDocument);
    const detailsXml = payment.items
      .map((item, index) => {
        const quantity = this.decimalToNumber(item.quantity);
        const unitPrice = this.decimalToNumber(item.unitPrice);
        const discount = this.decimalToNumber(item.discount);
        const total = this.decimalToNumber(item.total);
        const code =
          item.product?.sku ||
          `${item.type}-${String(index + 1).padStart(3, '0')}`;

        return [
          '    <detalle>',
          `      <codigoPrincipal>${this.xmlEscape(code)}</codigoPrincipal>`,
          `      <descripcion>${this.xmlEscape(item.description)}</descripcion>`,
          `      <cantidad>${this.quantity(quantity)}</cantidad>`,
          `      <precioUnitario>${this.money(unitPrice)}</precioUnitario>`,
          `      <descuento>${this.money(discount)}</descuento>`,
          `      <precioTotalSinImpuesto>${this.money(total)}</precioTotalSinImpuesto>`,
          '      <impuestos>',
          '        <impuesto>',
          '          <codigo>2</codigo>',
          '          <codigoPorcentaje>0</codigoPorcentaje>',
          '          <tarifa>0.00</tarifa>',
          `          <baseImponible>${this.money(total)}</baseImponible>`,
          '          <valor>0.00</valor>',
          '        </impuesto>',
          '      </impuestos>',
          '    </detalle>',
        ].join('\n');
      })
      .join('\n');

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<factura id="comprobante" version="1.1.0">',
      '  <infoTributaria>',
      `    <ambiente>${clinic.sri.environment === 'PRODUCTION' ? '2' : '1'}</ambiente>`,
      '    <tipoEmision>1</tipoEmision>',
      `    <razonSocial>${this.xmlEscape(clinic.legalName)}</razonSocial>`,
      `    <nombreComercial>${this.xmlEscape(clinic.name)}</nombreComercial>`,
      `    <ruc>${this.xmlEscape(clinic.taxId.replace(/\D/g, ''))}</ruc>`,
      `    <claveAcceso>${this.xmlEscape(invoice.accessKey)}</claveAcceso>`,
      '    <codDoc>01</codDoc>',
      `    <estab>${this.xmlEscape(invoice.establishmentCode)}</estab>`,
      `    <ptoEmi>${this.xmlEscape(invoice.emissionPoint)}</ptoEmi>`,
      `    <secuencial>${String(invoice.sequential).padStart(9, '0')}</secuencial>`,
      `    <dirMatriz>${this.xmlEscape(clinic.address)}</dirMatriz>`,
      '  </infoTributaria>',
      '  <infoFactura>',
      `    <fechaEmision>${issueDate}</fechaEmision>`,
      `    <dirEstablecimiento>${this.xmlEscape(clinic.address)}</dirEstablecimiento>`,
      ...(clinic.sri.specialTaxpayerNumber
        ? [
            `    <contribuyenteEspecial>${this.xmlEscape(
              clinic.sri.specialTaxpayerNumber,
            )}</contribuyenteEspecial>`,
          ]
        : []),
      `    <obligadoContabilidad>${clinic.sri.accountingRequired ? 'SI' : 'NO'}</obligadoContabilidad>`,
      `    <tipoIdentificacionComprador>${customerIdType}</tipoIdentificacionComprador>`,
      `    <razonSocialComprador>${this.xmlEscape(invoice.customerName)}</razonSocialComprador>`,
      `    <identificacionComprador>${this.xmlEscape(customerDocument || '9999999999999')}</identificacionComprador>`,
      `    <totalSinImpuestos>${totalWithoutTaxes}</totalSinImpuestos>`,
      `    <totalDescuento>${totalDiscount}</totalDescuento>`,
      '    <totalConImpuestos>',
      '      <totalImpuesto>',
      '        <codigo>2</codigo>',
      '        <codigoPorcentaje>0</codigoPorcentaje>',
      `        <baseImponible>${totalWithoutTaxes}</baseImponible>`,
      '        <valor>0.00</valor>',
      '      </totalImpuesto>',
      '    </totalConImpuestos>',
      '    <propina>0.00</propina>',
      `    <importeTotal>${totalAmount}</importeTotal>`,
      '    <moneda>DOLAR</moneda>',
      '    <pagos>',
      '      <pago>',
      `        <formaPago>${this.sriPaymentMethod(payment.method)}</formaPago>`,
      `        <total>${totalAmount}</total>`,
      '      </pago>',
      '    </pagos>',
      '  </infoFactura>',
      '  <detalles>',
      detailsXml,
      '  </detalles>',
      '  <infoAdicional>',
      `    <campoAdicional nombre="Documento interno">${this.xmlEscape(payment.invoiceNumber)}</campoAdicional>`,
      `    <campoAdicional nombre="Generado por">VetCare Pro</campoAdicional>`,
      ...(invoice.customerEmail
        ? [
            `    <campoAdicional nombre="Email">${this.xmlEscape(
              invoice.customerEmail,
            )}</campoAdicional>`,
          ]
        : []),
      '  </infoAdicional>',
      '</factura>',
      '',
    ].join('\n');
  }

  private async writeInvoiceXml(accessKey: string, xml: string) {
    const xmlRoot = resolve(process.env.SRI_XML_PATH ?? 'C:/VetCarePro/sri/xml');
    await mkdir(xmlRoot, { recursive: true });
    const targetPath = join(xmlRoot, `${accessKey}.xml`);
    await writeFile(targetPath, xml, 'utf8');
    return targetPath;
  }

  private async nextSequential(configuredStart: number) {
    const latest = await this.prisma.sriInvoice.findFirst({
      orderBy: { sequential: 'desc' },
      select: { sequential: true },
    });
    return Math.max(latest?.sequential ?? 0, configuredStart - 1) + 1;
  }

  private demoAccessKey(
    clinicRuc: string,
    customerDocument: string,
    establishmentCode: string,
    emissionPoint: string,
    sequential: number,
  ) {
    const now = new Date();
    const date = [
      String(now.getDate()).padStart(2, '0'),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getFullYear()),
    ].join('');
    const ruc = clinicRuc.replace(/\D/g, '').padStart(13, '0').slice(0, 13);
    const document = customerDocument.replace(/\D/g, '').padStart(13, '0');
    const serial = String(sequential).padStart(9, '0');
    const numericCode = document.slice(-8).padStart(8, '0');
    return `${date}01${ruc}${establishmentCode}${emissionPoint}${serial}${numericCode}1`;
  }

  private async getClinicSettings(): Promise<ClinicSettings> {
    const setting = await this.prisma.setting.findUnique({
      where: { key: CLINIC_SETTINGS_KEY },
      select: { value: true },
    });

    if (
      !setting?.value ||
      typeof setting.value !== 'object' ||
      Array.isArray(setting.value)
    ) {
      return mergeClinicSettings(null);
    }

    return mergeClinicSettings(setting.value as Partial<ClinicSettings>);
  }

  private validateSriSettings(clinic: ClinicSettings) {
    const missing: string[] = [];
    const ruc = clinic.taxId.replace(/\D/g, '');

    if (!clinic.sri.enabled) missing.push('activar facturacion SRI');
    if (!clinic.legalName.trim()) missing.push('razon social');
    if (clinic.taxIdType !== 'RUC') missing.push('tipo de identificacion RUC');
    if (!/^\d{13}$/.test(ruc)) missing.push('RUC de 13 digitos');
    if (!clinic.address.trim()) missing.push('direccion matriz');
    if (!/^\d{3}$/.test(clinic.sri.establishmentCode)) {
      missing.push('codigo de establecimiento');
    }
    if (!/^\d{3}$/.test(clinic.sri.emissionPoint)) {
      missing.push('punto de emision');
    }
    if (!clinic.sri.digitalSignatureConfigured) {
      missing.push('firma electronica configurada');
    }

    if (missing.length > 0) {
      throw new BadRequestException(
        `Configura los datos tributarios antes de emitir: ${missing.join(', ')}.`,
      );
    }
  }

  private xmlEscape(value: string | number | null | undefined) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private decimalToNumber(
    value: Prisma.Decimal | number | string | null | undefined,
  ) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value);
    return value.toNumber();
  }

  private money(value: Prisma.Decimal | number | string | null | undefined) {
    return this.decimalToNumber(value).toFixed(2);
  }

  private quantity(value: Prisma.Decimal | number | string | null | undefined) {
    return this.decimalToNumber(value).toFixed(3);
  }

  private formatSriDate(value: Date) {
    return [
      String(value.getDate()).padStart(2, '0'),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getFullYear()),
    ].join('/');
  }

  private customerIdentificationType(document: string) {
    if (/^9{13}$/.test(document)) return '07';
    if (/^\d{13}$/.test(document)) return '04';
    if (/^\d{10}$/.test(document)) return '05';
    return '06';
  }

  private sriPaymentMethod(method: string) {
    const methods: Record<string, string> = {
      CASH: '01',
      CARD: '19',
      CARD_DEBIT: '16',
      CARD_CREDIT: '19',
      BANK_TRANSFER: '20',
      OTHER: '01',
    };

    return methods[method] ?? '01';
  }

  private response(invoice: SriInvoicePayload) {
    return {
      ...invoice,
      payment: {
        ...invoice.payment,
        amount: invoice.payment.amount.toNumber(),
      },
    };
  }
}
