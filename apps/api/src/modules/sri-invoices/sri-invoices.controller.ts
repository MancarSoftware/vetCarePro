import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { createReadStream } from 'node:fs';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PERMISSIONS } from '../auth/authorization.constants';
import { SriInvoicesService } from './sri-invoices.service';

@Controller('sri-invoices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SriInvoicesController {
  constructor(private readonly sriInvoicesService: SriInvoicesService) {}

  @Get('payment/:paymentId')
  @RequirePermissions(PERMISSIONS.PAYMENTS_READ)
  async findByPayment(@Param('paymentId', ParseUUIDPipe) paymentId: string) {
    const invoice = await this.sriInvoicesService.findByPayment(paymentId);
    if (!invoice) {
      throw new NotFoundException('El cobro aun no tiene factura SRI');
    }
    return invoice;
  }

  @Post('payment/:paymentId')
  @RequirePermissions(PERMISSIONS.PAYMENTS_MANAGE)
  createFromPayment(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.sriInvoicesService.createFromPayment(actor.id, paymentId);
  }

  @Post(':id/demo-authorize')
  @RequirePermissions(PERMISSIONS.PAYMENTS_MANAGE)
  demoAuthorize(@Param('id', ParseUUIDPipe) sriInvoiceId: string) {
    return this.sriInvoicesService.demoAuthorize(sriInvoiceId);
  }

  @Post(':id/generate-xml')
  @RequirePermissions(PERMISSIONS.PAYMENTS_MANAGE)
  generateXml(@Param('id', ParseUUIDPipe) sriInvoiceId: string) {
    return this.sriInvoicesService.generateXml(sriInvoiceId);
  }

  @Post(':id/generate-ride')
  @RequirePermissions(PERMISSIONS.PAYMENTS_MANAGE)
  generateRide(@Param('id', ParseUUIDPipe) sriInvoiceId: string) {
    return this.sriInvoicesService.generateRide(sriInvoiceId);
  }

  @Get(':id/ride')
  @RequirePermissions(PERMISSIONS.PAYMENTS_READ)
  async openRide(@Param('id', ParseUUIDPipe) sriInvoiceId: string) {
    const file = await this.sriInvoicesService.getRideFile(sriInvoiceId);
    return new StreamableFile(createReadStream(file.absolutePath), {
      type: 'application/pdf',
      disposition: `inline; filename="${file.fileName}"`,
      length: file.sizeBytes,
    });
  }
}
