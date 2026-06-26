import {
  Body,
  Controller,
  Delete,
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
import { CreateFinanceExpenseDto } from './dto/create-finance-expense.dto';
import { FinanceQueryDto } from './dto/finance-query.dto';
import { FinanceService } from './finance.service';

@Controller('finance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('summary')
  @RequirePermissions(PERMISSIONS.FINANCE_READ)
  getSummary(@Query() query: FinanceQueryDto) {
    return this.financeService.getSummary(query);
  }

  @Get('expenses')
  @RequirePermissions(PERMISSIONS.FINANCE_READ)
  findExpenses(@Query() query: FinanceQueryDto) {
    return this.financeService.findExpenses(query);
  }

  @Post('expenses')
  @RequirePermissions(PERMISSIONS.FINANCE_MANAGE)
  createExpense(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateFinanceExpenseDto,
  ) {
    return this.financeService.createExpense(actor.id, dto);
  }

  @Delete('expenses/:id')
  @RequirePermissions(PERMISSIONS.FINANCE_MANAGE)
  removeExpense(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) expenseId: string,
  ) {
    return this.financeService.removeExpense(actor.id, expenseId);
  }
}
