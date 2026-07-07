import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, stat, writeFile } from 'node:fs/promises';
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

type SriInvoiceRidePayload = SriInvoiceXmlPayload;

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
    const customerName =
      payment.walkInCustomerName ||
      `${payment.owner.firstName} ${payment.owner.lastName}`;
    const customerDocument = this.resolveSriCustomerDocument(
      payment.walkInCustomerDocument || payment.owner.nationalId,
    );
    this.validateSriCustomer(customerName, customerDocument);

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
        customerName,
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

  async generateRide(sriInvoiceId: string) {
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
    if (!invoice.xmlPath) {
      throw new BadRequestException(
        'Primero genera el XML antes de crear el RIDE/PDF demo',
      );
    }

    const clinic = await this.getClinicSettings();
    this.validateSriSettings(clinic);
    const ridePath = await this.writeRidePdf(
      invoice.accessKey,
      this.buildRideLines(invoice, clinic),
    );

    const updated = await this.prisma.sriInvoice.update({
      where: { id: sriInvoiceId },
      data: {
        ridePath,
        sriMessage:
          invoice.status === SriInvoiceStatus.AUTHORIZED
            ? 'RIDE/PDF demo generado localmente. Autorizacion simulada lista.'
            : 'RIDE/PDF demo generado localmente. Pendiente autorizacion SRI real.',
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
          ridePath,
        },
      },
    });

    return this.response(updated);
  }

  async getRideFile(sriInvoiceId: string) {
    const invoice = await this.prisma.sriInvoice.findUnique({
      where: { id: sriInvoiceId },
      select: {
        accessKey: true,
        ridePath: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('La factura SRI no existe');
    }
    if (!invoice.ridePath) {
      throw new NotFoundException(
        'La factura SRI aun no tiene RIDE/PDF generado',
      );
    }

    const absolutePath = resolve(invoice.ridePath);
    const fileStats = await stat(absolutePath).catch(() => null);
    if (!fileStats?.isFile()) {
      throw new NotFoundException(
        'El archivo RIDE/PDF no existe en disco. Genera nuevamente el RIDE.',
      );
    }

    return {
      absolutePath,
      fileName: `RIDE-${invoice.accessKey}.pdf`,
      sizeBytes: fileStats.size,
    };
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

  private async writeRidePdf(accessKey: string, lines: string[]) {
    const rideRoot = resolve(
      process.env.SRI_RIDE_PATH ?? 'C:/VetCarePro/sri/ride',
    );
    await mkdir(rideRoot, { recursive: true });
    const targetPath = join(rideRoot, `${accessKey}.pdf`);
    await writeFile(targetPath, this.buildSimplePdf(lines));
    return targetPath;
  }

  private buildRideLines(
    invoice: SriInvoiceRidePayload,
    clinic: ClinicSettings,
  ) {
    const payment = invoice.payment;
    const customerName =
      payment.walkInCustomerName ||
      `${payment.owner.firstName} ${payment.owner.lastName}`;
    const customerDocument =
      payment.walkInCustomerDocument ||
      payment.owner.nationalId ||
      invoice.customerDocument;
    const issuedBy = `${invoice.issuedBy.firstName} ${invoice.issuedBy.lastName}`;
    const sequential = `${invoice.establishmentCode}-${invoice.emissionPoint}-${String(
      invoice.sequential,
    ).padStart(9, '0')}`;
    const lines = [
      'VETCARE PRO - RIDE / FACTURA DEMO',
      'Representacion impresa de comprobante electronico',
      '',
      `Clinica: ${clinic.name}`,
      `Razon social: ${clinic.legalName}`,
      `RUC: ${clinic.taxId}`,
      `Direccion matriz: ${clinic.address}`,
      `Ambiente: ${invoice.environment === 'PRODUCTION' ? 'PRODUCCION' : 'PRUEBAS'}`,
      '',
      `Factura: ${sequential}`,
      `Documento interno: ${payment.invoiceNumber}`,
      `Fecha emision: ${this.formatSriDate(new Date())}`,
      `Estado SRI: ${invoice.status}`,
      `Autorizacion: ${invoice.authorizationNumber ?? 'Pendiente / demo'}`,
      `Clave de acceso: ${invoice.accessKey}`,
      '',
      `Cliente: ${customerName}`,
      `Identificacion: ${customerDocument}`,
      `Correo: ${payment.owner.email ?? invoice.customerEmail ?? 'Sin correo'}`,
      '',
      'DETALLE',
      '------------------------------------------------------------',
      ...payment.items.flatMap((item, index) => [
        `${index + 1}. ${item.description}`,
        `   Cant: ${this.quantity(item.quantity)}  P.Unit: ${this.money(
          item.unitPrice,
        )}  Desc: ${this.money(item.discount)}  Total: ${this.money(
          item.total,
        )}`,
      ]),
      '------------------------------------------------------------',
      `Subtotal: ${this.money(payment.subtotal)}`,
      `Descuentos: ${this.money(payment.discount)}`,
      'IVA 0% demo: 0.00',
      `TOTAL: ${this.money(payment.amount)}`,
      '',
      `Generado por: ${issuedBy}`,
      'Nota: RIDE demo local. Pendiente firma, envio y autorizacion real del SRI.',
    ];

    return lines.flatMap((line) => this.wrapPdfLine(line, 88));
  }

  private buildSimplePdf(lines: string[]) {
    const contentLines = lines.slice(0, 46);
    const text = [
      'BT',
      '/F1 10 Tf',
      '50 790 Td',
      ...contentLines.flatMap((line, index) => [
        index === 0 ? '/F1 15 Tf' : index === 1 ? '/F1 9 Tf' : '/F1 10 Tf',
        `(${this.pdfEscape(line)}) Tj`,
        '0 -15 Td',
      ]),
      'ET',
    ].join('\n');
    const streamContent = `${text}\n`;
    const stream = Buffer.from(streamContent, 'latin1');
    const objects = [
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
      `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${streamContent}endstream\nendobj\n`,
    ];
    let offset = '%PDF-1.4\n'.length;
    const xref = objects.map((object) => {
      const current = offset;
      offset += Buffer.byteLength(object, 'latin1');
      return current;
    });
    const body = objects.join('');
    const xrefStart = Buffer.byteLength('%PDF-1.4\n' + body, 'latin1');
    const xrefRows = [
      'xref',
      '0 6',
      '0000000000 65535 f ',
      ...xref.map((entry) => `${String(entry).padStart(10, '0')} 00000 n `),
      'trailer',
      '<< /Size 6 /Root 1 0 R >>',
      'startxref',
      String(xrefStart),
      '%%EOF',
      '',
    ].join('\n');

    return Buffer.from(`%PDF-1.4\n${body}${xrefRows}`, 'latin1');
  }

  private wrapPdfLine(line: string, maxLength: number) {
    const clean = this.pdfText(line);
    if (clean.length <= maxLength) return [clean];

    const lines: string[] = [];
    let remaining = clean;
    while (remaining.length > maxLength) {
      const breakAt = Math.max(
        remaining.lastIndexOf(' ', maxLength),
        Math.min(maxLength, remaining.length),
      );
      lines.push(remaining.slice(0, breakAt).trim());
      remaining = remaining.slice(breakAt).trim();
    }
    if (remaining) lines.push(remaining);
    return lines;
  }

  private pdfText(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '?');
  }

  private pdfEscape(value: string) {
    return this.pdfText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
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
    if (/^\d{13}$/.test(ruc) && !this.isValidEcuadorRuc(ruc)) {
      missing.push('RUC valido con digito verificador');
    }
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

  private resolveSriCustomerDocument(document: string | null | undefined) {
    const digits = String(document ?? '').replace(/\D/g, '');
    return digits || '9999999999999';
  }

  private validateSriCustomer(customerName: string, customerDocument: string) {
    const errors: string[] = [];
    const document = customerDocument.replace(/\D/g, '');

    if (!customerName.trim()) {
      errors.push('nombre o razon social del comprador');
    }

    if (document === '9999999999999') {
      if (errors.length > 0) {
        throw new BadRequestException(
          `No se puede emitir factura SRI: ${errors.join(', ')}.`,
        );
      }
      return;
    }

    if (!/^\d{10}$|^\d{13}$/.test(document)) {
      errors.push('identificacion del comprador de 10 digitos o RUC de 13');
    } else if (document.length === 10 && !this.isValidEcuadorCedula(document)) {
      errors.push('cedula del comprador invalida');
    } else if (document.length === 13 && !this.isValidEcuadorRuc(document)) {
      errors.push('RUC del comprador invalido');
    }

    if (errors.length > 0) {
      throw new BadRequestException(
        `No se puede emitir factura SRI: ${errors.join(', ')}.`,
      );
    }
  }

  private isValidEcuadorCedula(document: string) {
    if (!/^\d{10}$/.test(document)) return false;
    const province = Number(document.slice(0, 2));
    const thirdDigit = Number(document[2]);
    if (!((province >= 1 && province <= 24) || province === 30)) return false;
    if (thirdDigit >= 6) return false;

    const sum = document
      .slice(0, 9)
      .split('')
      .reduce((total, digit, index) => {
        let value = Number(digit);
        if (index % 2 === 0) {
          value *= 2;
          if (value > 9) value -= 9;
        }
        return total + value;
      }, 0);
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === Number(document[9]);
  }

  private isValidEcuadorRuc(document: string) {
    if (document === '9999999999999') return true;
    if (!/^\d{13}$/.test(document)) return false;
    if (!document.endsWith('001')) return false;

    const thirdDigit = Number(document[2]);
    if (thirdDigit < 6) {
      return this.isValidEcuadorCedula(document.slice(0, 10));
    }
    if (thirdDigit === 6) {
      return this.isValidModulo11(document, [3, 2, 7, 6, 5, 4, 3, 2], 8);
    }
    if (thirdDigit === 9) {
      return this.isValidModulo11(document, [4, 3, 2, 7, 6, 5, 4, 3, 2], 9);
    }
    return false;
  }

  private isValidModulo11(
    document: string,
    coefficients: number[],
    checkDigitIndex: number,
  ) {
    const sum = coefficients.reduce(
      (total, coefficient, index) => total + Number(document[index]) * coefficient,
      0,
    );
    const remainder = sum % 11;
    const checkDigit = remainder === 0 ? 0 : 11 - remainder;
    if (checkDigit === 10) return false;
    return checkDigit === Number(document[checkDigitIndex]);
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
