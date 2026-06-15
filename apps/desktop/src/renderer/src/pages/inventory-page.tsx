import {
  ClinicalConfirmDialog,
  clinicalInputClass,
} from '@/components/clinical/clinical-ui';
import {
  InventoryMovementFormModal,
  InventoryProductFormModal,
  inventoryMovementLabel,
  isInboundInventoryMovement,
  type InventoryMovementFormState,
  type InventoryProductFormState,
} from '@/components/inventory/inventory-forms';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import type {
  InventoryMovement,
  InventoryMovementType,
  InventoryProduct,
  InventorySummary,
  PaginatedResponse,
} from '@/types/clinical';
import {
  format,
  formatDistanceToNow,
  isBefore,
  startOfDay,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  History,
  Layers3,
  LoaderCircle,
  Package,
  PackageCheck,
  PackageOpen,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

type InventoryTab = 'products' | 'movements';
type StockFilter =
  | 'ALL'
  | 'AVAILABLE'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'EXPIRING';

const emptySummary: InventorySummary = {
  totalProducts: 0,
  lowStock: 0,
  outOfStock: 0,
  expiringSoon: 0,
  expiredBatches: 0,
  inventoryValue: 0,
};

const currency = new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

const number = new Intl.NumberFormat('es-EC', {
  maximumFractionDigits: 3,
});

const movementTone: Record<
  InventoryMovementType,
  { icon: LucideIcon; className: string }
> = {
  PURCHASE: {
    icon: ArrowDownToLine,
    className: 'bg-emerald-50 text-emerald-700',
  },
  RETURN: {
    icon: ArrowDownToLine,
    className: 'bg-teal-50 text-teal-700',
  },
  ADJUSTMENT_IN: {
    icon: ArrowDownToLine,
    className: 'bg-blue-50 text-blue-700',
  },
  SALE: {
    icon: ArrowUpFromLine,
    className: 'bg-violet-50 text-violet-700',
  },
  CLINICAL_USE: {
    icon: ArrowUpFromLine,
    className: 'bg-cyan-50 text-cyan-700',
  },
  ADJUSTMENT_OUT: {
    icon: ArrowUpFromLine,
    className: 'bg-amber-50 text-amber-700',
  },
  EXPIRED: {
    icon: AlertTriangle,
    className: 'bg-rose-50 text-rose-700',
  },
};

export function InventoryPage() {
  const { request, user } = useAuth();
  const [tab, setTab] = useState<InventoryTab>('products');
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [summary, setSummary] = useState(emptySummary);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('ALL');
  const [movementType, setMovementType] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] =
    useState<InventoryProduct | null>(null);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [movementProduct, setMovementProduct] =
    useState<InventoryProduct | null>(null);
  const [detailProduct, setDetailProduct] =
    useState<InventoryProduct | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [deletingProduct, setDeletingProduct] =
    useState<InventoryProduct | null>(null);
  const canManage =
    user?.permissions.includes('inventory.manage') ?? false;

  const loadProducts = useCallback(async () => {
    const query = new URLSearchParams({
      page: '1',
      pageSize: '100',
      stockStatus: stockFilter,
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(category ? { category } : {}),
    });
    const data = await request<PaginatedResponse<InventoryProduct>>(
      `/inventory/products?${query.toString()}`,
    );
    setProducts(data.items);
  }, [category, request, search, stockFilter]);

  const loadSummary = useCallback(async () => {
    const [summaryData, categoryData] = await Promise.all([
      request<InventorySummary>('/inventory/summary'),
      request<string[]>('/inventory/categories'),
    ]);
    setSummary(summaryData);
    setCategories(categoryData);
  }, [request]);

  const loadMovements = useCallback(async () => {
    const query = new URLSearchParams({
      page: '1',
      pageSize: '100',
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(movementType ? { type: movementType } : {}),
    });
    const data = await request<PaginatedResponse<InventoryMovement>>(
      `/inventory/movements?${query.toString()}`,
    );
    setMovements(data.items);
  }, [movementType, request, search]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadSummary(),
        tab === 'products' ? loadProducts() : loadMovements(),
      ]);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No fue posible cargar el inventario.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [loadMovements, loadProducts, loadSummary, tab]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const openDetail = async (productId: string) => {
    setIsDetailLoading(true);
    try {
      const product = await request<InventoryProduct>(
        `/inventory/products/${productId}`,
      );
      setDetailProduct(product);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No fue posible abrir el producto.',
      );
    } finally {
      setIsDetailLoading(false);
    }
  };

  const openMovement = async (product: InventoryProduct) => {
    try {
      const detail =
        product.movements !== undefined
          ? product
          : await request<InventoryProduct>(
              `/inventory/products/${product.id}`,
            );
      setMovementProduct(detail);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No fue posible preparar el movimiento.',
      );
    }
  };

  const submitProduct = async (form: InventoryProductFormState) => {
    setIsSubmitting(true);
    const optional = (value: string) => value.trim() || null;
    const optionalNumber = (value: string) =>
      value.trim() ? Number(value) : null;
    try {
      await request(
        editingProduct
          ? `/inventory/products/${editingProduct.id}`
          : '/inventory/products',
        {
          method: editingProduct ? 'PATCH' : 'POST',
          body: {
            sku: optional(form.sku),
            name: form.name.trim(),
            category: form.category.trim(),
            unit: form.unit.trim(),
            minimumStock: Number(form.minimumStock),
            purchasePrice: optionalNumber(form.purchasePrice),
            salePrice: optionalNumber(form.salePrice),
            supplier: optional(form.supplier),
            ...(!editingProduct
              ? {
                  initialStock: Number(form.initialStock || 0),
                  batchNumber: optional(form.batchNumber),
                  expirationDate: form.expirationDate || undefined,
                  notes: optional(form.notes),
                }
              : {}),
          },
        },
      );
      setIsProductFormOpen(false);
      setEditingProduct(null);
      await refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitMovement = async (form: InventoryMovementFormState) => {
    if (!movementProduct) return;
    setIsSubmitting(true);
    const optional = (value: string) => value.trim() || null;
    try {
      const updated = await request<InventoryProduct>(
        `/inventory/products/${movementProduct.id}/movements`,
        {
          method: 'POST',
          body: {
            type: form.type,
            quantity: Number(form.quantity),
            unitCost: form.unitCost ? Number(form.unitCost) : undefined,
            batchId: form.batchId || undefined,
            batchNumber: optional(form.batchNumber),
            expirationDate: form.expirationDate || undefined,
            referenceType: optional(form.referenceType),
            referenceId: optional(form.referenceId),
            notes: optional(form.notes),
          },
        },
      );
      setMovementProduct(null);
      if (detailProduct?.id === updated.id) {
        setDetailProduct(updated);
      }
      await refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeProduct = async () => {
    if (!deletingProduct) return;
    setIsSubmitting(true);
    try {
      await request(`/inventory/products/${deletingProduct.id}`, {
        method: 'DELETE',
      });
      setDeletingProduct(null);
      setDetailProduct(null);
      await refresh();
    } catch (deleteError) {
      setDeletingProduct(null);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'No fue posible archivar el producto.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtersActive =
    Boolean(search || category || movementType) || stockFilter !== 'ALL';

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">
            Control de existencias
          </p>
          <h1 className="mt-2 text-[28px] font-bold tracking-[-0.04em] text-slate-950">
            Inventario
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Productos, lotes, vencimientos y movimientos de la clínica.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setEditingProduct(null);
              setIsProductFormOpen(true);
            }}
            className="h-10 bg-teal-600 px-4 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700"
          >
            <Plus className="size-4" />
            Nuevo producto
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            <X className="size-4" />
          </button>
        </div>
      )}

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <InventoryMetric
          icon={Boxes}
          label="Productos activos"
          value={number.format(summary.totalProducts)}
          tone="teal"
        />
        <InventoryMetric
          icon={CircleDollarSign}
          label="Valor del inventario"
          value={currency.format(summary.inventoryValue)}
          tone="blue"
        />
        <InventoryMetric
          icon={AlertTriangle}
          label="Stock bajo"
          value={number.format(summary.lowStock)}
          tone="amber"
        />
        <InventoryMetric
          icon={PackageOpen}
          label="Sin existencias"
          value={number.format(summary.outOfStock)}
          tone="rose"
        />
        <InventoryMetric
          icon={CalendarClock}
          label="Lotes por vencer"
          value={number.format(summary.expiringSoon)}
          detail={
            summary.expiredBatches
              ? `${summary.expiredBatches} ya vencidos`
              : 'Próximos 30 días'
          }
          tone="violet"
        />
      </section>

      <Card className="mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 pt-4">
          <div className="flex gap-6">
            <TabButton
              active={tab === 'products'}
              icon={Package}
              label="Productos"
              onClick={() => {
                setTab('products');
                setSearch('');
              }}
            />
            <TabButton
              active={tab === 'movements'}
              icon={History}
              label="Movimientos"
              onClick={() => {
                setTab('movements');
                setSearch('');
              }}
            />
          </div>
          <p className="pb-4 text-xs text-slate-400">
            {tab === 'products'
              ? `${products.length} productos visibles`
              : `${movements.length} movimientos recientes`}
          </p>
        </div>

        <div className="grid grid-cols-[1fr_220px_220px] gap-3 border-b border-slate-100 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                tab === 'products'
                  ? 'Buscar por nombre, SKU, categoría o proveedor...'
                  : 'Buscar producto, referencia u observación...'
              }
              className={`${clinicalInputClass} pl-10`}
            />
          </div>
          {tab === 'products' ? (
            <>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className={clinicalInputClass}
              >
                <option value="">Todas las categorías</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select
                value={stockFilter}
                onChange={(event) =>
                  setStockFilter(event.target.value as StockFilter)
                }
                className={clinicalInputClass}
              >
                <option value="ALL">Todos los estados</option>
                <option value="AVAILABLE">Stock disponible</option>
                <option value="LOW_STOCK">Stock bajo</option>
                <option value="OUT_OF_STOCK">Sin existencias</option>
                <option value="EXPIRING">Próximos a vencer</option>
              </select>
            </>
          ) : (
            <>
              <select
                value={movementType}
                onChange={(event) => setMovementType(event.target.value)}
                className={clinicalInputClass}
              >
                <option value="">Todos los movimientos</option>
                {(Object.keys(movementTone) as InventoryMovementType[]).map(
                  (type) => (
                    <option key={type} value={type}>
                      {inventoryMovementLabel(type)}
                    </option>
                  ),
                )}
              </select>
              <Button
                disabled={!filtersActive}
                onClick={() => {
                  setSearch('');
                  setMovementType('');
                }}
                className="h-11 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              >
                <X className="size-4" />
                Limpiar filtros
              </Button>
            </>
          )}
        </div>

        {isLoading ? (
          <InventoryLoading />
        ) : tab === 'products' ? (
          <ProductsTable
            products={products}
            canManage={canManage}
            onDetail={(product) => void openDetail(product.id)}
            onEdit={(product) => {
              setEditingProduct(product);
              setIsProductFormOpen(true);
            }}
            onMovement={(product) => void openMovement(product)}
          />
        ) : (
          <MovementsTable movements={movements} />
        )}
      </Card>

      {isProductFormOpen && (
        <InventoryProductFormModal
          product={editingProduct}
          categories={categories}
          submitting={isSubmitting}
          onClose={() => {
            setIsProductFormOpen(false);
            setEditingProduct(null);
          }}
          onSubmit={submitProduct}
        />
      )}

      {movementProduct && (
        <InventoryMovementFormModal
          product={movementProduct}
          submitting={isSubmitting}
          onClose={() => setMovementProduct(null)}
          onSubmit={submitMovement}
        />
      )}

      {detailProduct && (
        <InventoryDetailModal
          product={detailProduct}
          canManage={canManage}
          onClose={() => setDetailProduct(null)}
          onEdit={() => {
            setEditingProduct(detailProduct);
            setIsProductFormOpen(true);
          }}
          onMovement={() => void openMovement(detailProduct)}
          onArchive={() => setDeletingProduct(detailProduct)}
        />
      )}

      {deletingProduct && (
        <ClinicalConfirmDialog
          title="Archivar producto"
          message={`Se archivará ${deletingProduct.name}. Solo es posible cuando su stock esté en cero.`}
          disabled={isSubmitting}
          onCancel={() => setDeletingProduct(null)}
          onConfirm={() => void removeProduct()}
        />
      )}

      {isDetailLoading && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/15">
          <div className="grid size-12 place-items-center rounded-xl bg-white shadow-xl">
            <LoaderCircle className="size-5 animate-spin text-teal-600" />
          </div>
        </div>
      )}
    </>
  );
}

function InventoryMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  tone: 'teal' | 'blue' | 'amber' | 'rose' | 'violet';
}) {
  const tones = {
    teal: 'bg-teal-50 text-teal-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    violet: 'bg-violet-50 text-violet-700',
  };
  return (
    <Card className="flex items-center gap-4 p-4">
      <div
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-xl',
          tones[tone],
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xl font-bold text-slate-900">{value}</p>
        <p className="truncate text-xs text-slate-500">{label}</p>
        {detail && (
          <p className="mt-1 truncate text-[10px] font-semibold text-slate-400">
            {detail}
          </p>
        )}
      </div>
    </Card>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 border-b-2 pb-4 text-sm font-bold transition',
        active
          ? 'border-teal-600 text-teal-700'
          : 'border-transparent text-slate-400 hover:text-slate-600',
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function ProductsTable({
  products,
  canManage,
  onDetail,
  onEdit,
  onMovement,
}: {
  products: InventoryProduct[];
  canManage: boolean;
  onDetail: (product: InventoryProduct) => void;
  onEdit: (product: InventoryProduct) => void;
  onMovement: (product: InventoryProduct) => void;
}) {
  if (products.length === 0) {
    return (
      <InventoryEmpty
        icon={PackageOpen}
        title="No encontramos productos"
        description="Registra el primer producto o modifica los filtros actuales."
      />
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50/80 text-slate-400">
          <tr>
            <th className="px-5 py-3 font-semibold">Producto</th>
            <th className="px-4 py-3 font-semibold">Categoría</th>
            <th className="px-4 py-3 font-semibold">Stock</th>
            <th className="px-4 py-3 font-semibold">Próximo vencimiento</th>
            <th className="px-4 py-3 font-semibold">Precio venta</th>
            <th className="px-5 py-3 text-right font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const status = getProductStatus(product);
            return (
              <tr
                key={product.id}
                className="border-t border-slate-100 transition hover:bg-slate-50/60"
              >
                <td className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => onDetail(product)}
                    className="flex items-center gap-3 text-left"
                  >
                    <div className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-600">
                      <Package className="size-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">
                        {product.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {product.sku || 'Sin SKU'}
                        {product.supplier
                          ? ` · ${product.supplier}`
                          : ''}
                      </p>
                    </div>
                  </button>
                </td>
                <td className="px-4 py-4 text-slate-600">
                  {product.category}
                </td>
                <td className="px-4 py-4">
                  <p className="font-bold text-slate-800">
                    {number.format(product.currentStock)} {product.unit}
                  </p>
                  <Badge className={status.className}>{status.label}</Badge>
                </td>
                <td className="px-4 py-4">
                  <ExpirationLabel value={product.nextExpiration ?? null} />
                </td>
                <td className="px-4 py-4 font-semibold text-slate-700">
                  {product.salePrice !== null
                    ? currency.format(product.salePrice)
                    : 'Sin precio'}
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-2">
                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => onMovement(product)}
                          title="Registrar movimiento"
                          className="grid size-8 place-items-center rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100"
                        >
                          <Layers3 className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(product)}
                          title="Editar producto"
                          className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Pencil className="size-4" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => onDetail(product)}
                      title="Ver detalle"
                      className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MovementsTable({
  movements,
  compact = false,
}: {
  movements: InventoryMovement[];
  compact?: boolean;
}) {
  if (movements.length === 0) {
    return (
      <InventoryEmpty
        icon={ClipboardList}
        title="No hay movimientos registrados"
        description="Las entradas, ventas, usos clínicos y ajustes aparecerán aquí."
      />
    );
  }
  return (
    <div className="divide-y divide-slate-100">
      {movements.map((movement) => {
        const tone = movementTone[movement.type];
        const Icon = tone.icon;
        const inbound = isInboundInventoryMovement(movement.type);
        return (
          <div
            key={movement.id}
            className={cn(
              'grid items-center gap-4 px-5 py-4',
              compact
                ? 'grid-cols-[40px_1fr_auto]'
                : 'grid-cols-[44px_1.3fr_0.7fr_0.7fr_auto]',
            )}
          >
            <div
              className={cn(
                'grid size-10 place-items-center rounded-xl',
                tone.className,
              )}
            >
              <Icon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-800">
                {movement.product?.name ??
                  inventoryMovementLabel(movement.type)}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-slate-400">
                {inventoryMovementLabel(movement.type)}
                {movement.batch?.batchNumber
                  ? ` · Lote ${movement.batch.batchNumber}`
                  : ''}
              </p>
            </div>
            {!compact && (
              <>
                <div>
                  <p
                    className={cn(
                      'text-sm font-bold',
                      inbound ? 'text-emerald-600' : 'text-slate-800',
                    )}
                  >
                    {inbound ? '+' : '-'}
                    {number.format(movement.quantity)}{' '}
                    {movement.product?.unit ?? ''}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {movement.unitCost !== null
                      ? `${currency.format(movement.unitCost)} c/u`
                      : 'Sin costo'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600">
                    {movement.referenceId || 'Sin referencia'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {movement.performedBy.firstName}{' '}
                    {movement.performedBy.lastName}
                  </p>
                </div>
              </>
            )}
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-600">
                {format(new Date(movement.createdAt), 'dd/MM/yyyy HH:mm')}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {formatDistanceToNow(new Date(movement.createdAt), {
                  addSuffix: true,
                  locale: es,
                })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InventoryDetailModal({
  product,
  canManage,
  onClose,
  onEdit,
  onMovement,
  onArchive,
}: {
  product: InventoryProduct;
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
  onMovement: () => void;
  onArchive: () => void;
}) {
  const activeBatches = product.batches.filter(
    (batch) => batch.currentQuantity > 0,
  );
  const status = getProductStatus(product);
  const margin =
    product.purchasePrice !== null && product.salePrice !== null
      ? product.salePrice - product.purchasePrice
      : null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-6 backdrop-blur-sm">
      <Card className="max-h-[92vh] w-full max-w-6xl overflow-y-auto">
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div className="flex items-center gap-4">
            <div className="grid size-14 place-items-center rounded-2xl bg-teal-50 text-teal-600">
              <Package className="size-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">
                  {product.name}
                </h2>
                <Badge className={status.className}>{status.label}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {product.category} · {product.sku || 'Sin SKU'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <>
                <Button
                  onClick={onMovement}
                  className="bg-teal-600 text-white hover:bg-teal-700"
                >
                  <Layers3 className="size-4" />
                  Movimiento
                </Button>
                <Button
                  onClick={onEdit}
                  className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                >
                  <Pencil className="size-4" />
                  Editar
                </Button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[0.8fr_1.2fr] gap-5 p-6">
          <div className="space-y-4">
            <Card className="p-5 shadow-none">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-teal-600">
                Resumen de existencias
              </p>
              <div className="mt-4 rounded-2xl bg-slate-950 p-5 text-white">
                <p className="text-xs text-slate-400">Stock disponible</p>
                <p className="mt-1 text-3xl font-bold">
                  {number.format(product.currentStock)}
                  <span className="ml-2 text-sm font-medium text-slate-400">
                    {product.unit}
                  </span>
                </p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      status.key === 'OUT_OF_STOCK'
                        ? 'bg-rose-500'
                        : status.key === 'LOW_STOCK'
                          ? 'bg-amber-400'
                          : 'bg-teal-400',
                    )}
                    style={{
                      width: `${Math.min(
                        100,
                        product.minimumStock
                          ? (product.currentStock /
                              (product.minimumStock * 2)) *
                              100
                          : 100,
                      )}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Nivel mínimo: {number.format(product.minimumStock)}{' '}
                  {product.unit}
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <InfoTile
                  icon={CircleDollarSign}
                  label="Costo"
                  value={
                    product.purchasePrice !== null
                      ? currency.format(product.purchasePrice)
                      : 'Sin definir'
                  }
                />
                <InfoTile
                  icon={Tag}
                  label="Venta"
                  value={
                    product.salePrice !== null
                      ? currency.format(product.salePrice)
                      : 'Sin definir'
                  }
                />
                <InfoTile
                  icon={Truck}
                  label="Proveedor"
                  value={product.supplier || 'Sin definir'}
                />
                <InfoTile
                  icon={CircleDollarSign}
                  label="Margen unitario"
                  value={margin !== null ? currency.format(margin) : '-'}
                />
              </div>
            </Card>

            <Card className="overflow-hidden shadow-none">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Lotes disponibles
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {activeBatches.length} con existencias
                  </p>
                </div>
                <Layers3 className="size-5 text-teal-600" />
              </div>
              {activeBatches.length ? (
                <div className="divide-y divide-slate-100">
                  {activeBatches.map((batch) => (
                    <div
                      key={batch.id}
                      className="flex items-center justify-between px-5 py-4"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-700">
                          {batch.batchNumber || 'Lote sin número'}
                        </p>
                        <ExpirationLabel value={batch.expirationDate} />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900">
                          {number.format(batch.currentQuantity)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {product.unit}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-8 text-center text-sm text-slate-400">
                  No hay lotes con existencias.
                </div>
              )}
            </Card>

            {canManage && (
              <Button
                onClick={onArchive}
                disabled={product.currentStock > 0}
                title={
                  product.currentStock > 0
                    ? 'El stock debe quedar en cero'
                    : 'Archivar producto'
                }
                className="w-full border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
              >
                <Trash2 className="size-4" />
                Archivar producto
              </Button>
            )}
          </div>

          <Card className="overflow-hidden shadow-none">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-sm font-bold text-slate-800">
                  Historial de movimientos
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {product._count.movements} operaciones registradas
                </p>
              </div>
              <History className="size-5 text-teal-600" />
            </div>
            <MovementsTable
              movements={(product.movements ?? []).slice(0, 60)}
              compact
            />
          </Card>
        </div>
      </Card>
    </div>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <Icon className="size-4 text-slate-400" />
      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-bold text-slate-700">{value}</p>
    </div>
  );
}

function ExpirationLabel({ value }: { value: string | null }) {
  if (!value) {
    return <span className="text-[11px] text-slate-400">Sin vencimiento</span>;
  }
  const date = localDateOnly(value);
  const expired = isBefore(date, startOfDay(new Date()));
  const days = Math.ceil(
    (date.getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000,
  );
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-semibold',
        expired
          ? 'text-rose-600'
          : days <= 30
            ? 'text-amber-600'
            : 'text-slate-500',
      )}
    >
      <Clock3 className="size-3" />
      {expired
        ? `Venció ${format(date, 'dd/MM/yyyy')}`
        : `Vence ${format(date, 'dd/MM/yyyy')}`}
    </span>
  );
}

function getProductStatus(product: InventoryProduct) {
  const key =
    product.stockStatus ??
    (product.currentStock <= 0
      ? 'OUT_OF_STOCK'
      : product.currentStock <= product.minimumStock
        ? 'LOW_STOCK'
        : 'AVAILABLE');
  if (key === 'OUT_OF_STOCK') {
    return {
      key,
      label: 'Sin stock',
      className: 'mt-1 bg-rose-50 text-rose-700',
    };
  }
  if (key === 'LOW_STOCK') {
    return {
      key,
      label: 'Stock bajo',
      className: 'mt-1 bg-amber-50 text-amber-700',
    };
  }
  return {
    key,
    label: 'Disponible',
    className: 'mt-1 bg-emerald-50 text-emerald-700',
  };
}

function InventoryLoading() {
  return (
    <div className="space-y-px">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-[72px] animate-pulse border-t border-slate-100 bg-slate-50/50"
        />
      ))}
    </div>
  );
}

function InventoryEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="grid min-h-[360px] place-items-center p-8 text-center">
      <div>
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-teal-50 text-teal-600">
          <Icon className="size-8" />
        </div>
        <h2 className="mt-5 text-lg font-bold text-slate-900">{title}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

function localDateOnly(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}
