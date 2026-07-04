import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
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
}
