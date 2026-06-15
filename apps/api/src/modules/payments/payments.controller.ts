import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PERMISSIONS } from '../auth/authorization.constants';
import { CreatePaymentTransactionDto } from './dto/create-payment-transaction.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsQueryDto } from './dto/payments-query.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PAYMENTS_READ)
  findAll(@Query() query: PaymentsQueryDto) {
    return this.paymentsService.findAll(query);
  }

  @Get('summary')
  @RequirePermissions(PERMISSIONS.PAYMENTS_READ)
  getSummary() {
    return this.paymentsService.getSummary();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PAYMENTS_READ)
  findOne(@Param('id', ParseUUIDPipe) paymentId: string) {
    return this.paymentsService.findOne(paymentId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PAYMENTS_MANAGE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.create(actor.id, dto);
  }

  @Post(':id/transactions')
  @RequirePermissions(PERMISSIONS.PAYMENTS_MANAGE)
  createTransaction(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) paymentId: string,
    @Body() dto: CreatePaymentTransactionDto,
  ) {
    return this.paymentsService.createTransaction(actor.id, paymentId, dto);
  }

  @Post(':id/void')
  @RequirePermissions(PERMISSIONS.PAYMENTS_MANAGE)
  voidPayment(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) paymentId: string,
  ) {
    return this.paymentsService.voidPayment(actor.id, paymentId);
  }
}
