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

    const sequential = await this.nextSequential();
    const customerDocument =
      payment.walkInCustomerDocument ||
      payment.owner.nationalId ||
      '9999999999999';
    const created = await this.prisma.sriInvoice.create({
      data: {
        paymentId,
        issuedById: actorId,
        sequential,
        accessKey: this.demoAccessKey(customerDocument, sequential),
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

  private async nextSequential() {
    const latest = await this.prisma.sriInvoice.findFirst({
      orderBy: { sequential: 'desc' },
      select: { sequential: true },
    });
    return (latest?.sequential ?? 0) + 1;
  }

  private demoAccessKey(customerDocument: string, sequential: number) {
    const now = new Date();
    const date = [
      String(now.getDate()).padStart(2, '0'),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getFullYear()),
    ].join('');
    const document = customerDocument.replace(/\D/g, '').padStart(13, '0');
    const serial = String(sequential).padStart(9, '0');
    return `${date}01${document.slice(0, 13)}001001${serial}123456781`;
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
