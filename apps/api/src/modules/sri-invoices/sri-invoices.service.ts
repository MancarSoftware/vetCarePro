import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

    const authorized = await this.prisma.sriInvoice.update({
      where: { id: sriInvoiceId },
      data: {
        status: SriInvoiceStatus.AUTHORIZED,
        authorizationNumber: `DEMO-${invoice.accessKey.slice(-16)}`,
        authorizedAt: new Date(),
        xmlPath: `C:/VetCarePro/sri/xml/${invoice.accessKey}.xml`,
        ridePath: `C:/VetCarePro/sri/ride/${invoice.accessKey}.pdf`,
        sriMessage:
          'Autorizacion simulada. Pendiente integracion real con servicios SRI.',
      },
      include: sriInvoiceInclude,
    });

    return this.response(authorized);
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
