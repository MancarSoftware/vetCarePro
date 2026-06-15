import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';
import { CreateInventoryProductDto } from './dto/create-inventory-product.dto';
import { InventoryMovementsQueryDto } from './dto/inventory-movements-query.dto';
import { InventoryProductsQueryDto } from './dto/inventory-products-query.dto';
import { UpdateInventoryProductDto } from './dto/update-inventory-product.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('summary')
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  getSummary() {
    return this.inventoryService.getSummary();
  }

  @Get('categories')
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  getCategories() {
    return this.inventoryService.getCategories();
  }

  @Get('movements')
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  findMovements(@Query() query: InventoryMovementsQueryDto) {
    return this.inventoryService.findMovements(query);
  }

  @Get('products')
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  findProducts(@Query() query: InventoryProductsQueryDto) {
    return this.inventoryService.findProducts(query);
  }

  @Get('products/:id')
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  findProduct(@Param('id', ParseUUIDPipe) productId: string) {
    return this.inventoryService.findProduct(productId);
  }

  @Post('products')
  @RequirePermissions(PERMISSIONS.INVENTORY_MANAGE)
  createProduct(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateInventoryProductDto,
  ) {
    return this.inventoryService.createProduct(actor.id, dto);
  }

  @Patch('products/:id')
  @RequirePermissions(PERMISSIONS.INVENTORY_MANAGE)
  updateProduct(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateInventoryProductDto,
  ) {
    return this.inventoryService.updateProduct(actor.id, productId, dto);
  }

  @Delete('products/:id')
  @RequirePermissions(PERMISSIONS.INVENTORY_MANAGE)
  removeProduct(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) productId: string,
  ) {
    return this.inventoryService.removeProduct(actor.id, productId);
  }

  @Post('products/:id/movements')
  @RequirePermissions(PERMISSIONS.INVENTORY_MANAGE)
  createMovement(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) productId: string,
    @Body() dto: CreateInventoryMovementDto,
  ) {
    return this.inventoryService.createMovement(actor.id, productId, dto);
  }
}
