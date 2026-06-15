import {
  ClinicalField,
  ClinicalModalHeader,
  clinicalInputClass,
} from '@/components/clinical/clinical-ui';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type {
  InventoryMovementType,
  InventoryProduct,
} from '@/types/clinical';
import { format } from 'date-fns';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  LoaderCircle,
  PackagePlus,
  Save,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

export interface InventoryProductFormState {
  sku: string;
  name: string;
  category: string;
  unit: string;
  minimumStock: string;
  purchasePrice: string;
  salePrice: string;
  supplier: string;
  initialStock: string;
  batchNumber: string;
  expirationDate: string;
  notes: string;
}

export interface InventoryMovementFormState {
  type: InventoryMovementType;
  quantity: string;
  unitCost: string;
  batchId: string;
  batchNumber: string;
  expirationDate: string;
  referenceType: string;
  referenceId: string;
  notes: string;
}

const defaultProductForm: InventoryProductFormState = {
  sku: '',
  name: '',
  category: 'Medicamentos',
  unit: 'unidad',
  minimumStock: '0',
  purchasePrice: '',
  salePrice: '',
  supplier: '',
  initialStock: '0',
  batchNumber: '',
  expirationDate: '',
  notes: '',
};

const movementLabels: Record<InventoryMovementType, string> = {
  PURCHASE: 'Compra / entrada',
  SALE: 'Venta',
  ADJUSTMENT_IN: 'Ajuste de entrada',
  ADJUSTMENT_OUT: 'Ajuste de salida',
  CLINICAL_USE: 'Uso clínico',
  RETURN: 'Devolución recibida',
  EXPIRED: 'Baja por vencimiento',
};

const inboundTypes = new Set<InventoryMovementType>([
  'PURCHASE',
  'ADJUSTMENT_IN',
  'RETURN',
]);

export function InventoryProductFormModal({
  product,
  categories,
  submitting,
  onClose,
  onSubmit,
}: {
  product: InventoryProduct | null;
  categories: string[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (form: InventoryProductFormState) => Promise<void>;
}) {
  const [form, setForm] = useState<InventoryProductFormState>(
    product
      ? {
          sku: product.sku ?? '',
          name: product.name,
          category: product.category,
          unit: product.unit,
          minimumStock: product.minimumStock.toString(),
          purchasePrice: product.purchasePrice?.toString() ?? '',
          salePrice: product.salePrice?.toString() ?? '',
          supplier: product.supplier ?? '',
          initialStock: '0',
          batchNumber: '',
          expirationDate: '',
          notes: '',
        }
      : defaultProductForm,
  );
  const [error, setError] = useState<string | null>(null);

  const update = (field: keyof InventoryProductFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (form.name.trim().length < 2 || form.category.trim().length < 2) {
      setError('Completa el nombre y la categoría del producto.');
      return;
    }
    if (Number(form.minimumStock) < 0 || Number(form.initialStock) < 0) {
      setError('Las existencias no pueden ser negativas.');
      return;
    }
    try {
      await onSubmit(form);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No fue posible guardar el producto.',
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-6 backdrop-blur-sm">
      <Card className="max-h-[92vh] w-full max-w-4xl overflow-y-auto p-6">
        <ClinicalModalHeader
          eyebrow={product ? 'Editar catálogo' : 'Nuevo artículo'}
          title={product ? product.name : 'Registrar producto'}
          onClose={onClose}
        />
        <form onSubmit={(event) => void submit(event)} className="mt-6">
          {error && (
            <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <ClinicalField label="Nombre del producto">
              <input
                required
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                placeholder="Ej. Amoxicilina 250 mg"
                className={clinicalInputClass}
              />
            </ClinicalField>
            <ClinicalField label="SKU / código" optional>
              <input
                value={form.sku}
                onChange={(event) => update('sku', event.target.value)}
                placeholder="MED-001"
                className={clinicalInputClass}
              />
            </ClinicalField>
            <ClinicalField label="Categoría">
              <input
                required
                list="inventory-categories"
                value={form.category}
                onChange={(event) => update('category', event.target.value)}
                placeholder="Medicamentos"
                className={clinicalInputClass}
              />
              <datalist id="inventory-categories">
                {[
                  'Medicamentos',
                  'Vacunas',
                  'Alimentos',
                  'Insumos médicos',
                  'Antipulgas',
                  'Desparasitantes',
                  'Accesorios',
                  ...categories,
                ].map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </ClinicalField>
            <ClinicalField label="Unidad de medida">
              <input
                required
                value={form.unit}
                onChange={(event) => update('unit', event.target.value)}
                placeholder="unidad, dosis, frasco..."
                className={clinicalInputClass}
              />
            </ClinicalField>
            <ClinicalField label="Stock mínimo">
              <input
                type="number"
                min="0"
                step="0.001"
                required
                value={form.minimumStock}
                onChange={(event) =>
                  update('minimumStock', event.target.value)
                }
                className={clinicalInputClass}
              />
            </ClinicalField>
            <ClinicalField label="Proveedor" optional>
              <input
                value={form.supplier}
                onChange={(event) => update('supplier', event.target.value)}
                placeholder="Laboratorio o distribuidor"
                className={clinicalInputClass}
              />
            </ClinicalField>
            <ClinicalField label="Precio de compra" optional>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.purchasePrice}
                onChange={(event) =>
                  update('purchasePrice', event.target.value)
                }
                placeholder="0.00"
                className={clinicalInputClass}
              />
            </ClinicalField>
            <ClinicalField label="Precio de venta" optional>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.salePrice}
                onChange={(event) =>
                  update('salePrice', event.target.value)
                }
                placeholder="0.00"
                className={clinicalInputClass}
              />
            </ClinicalField>
          </div>

          {!product && (
            <div className="mt-6 rounded-2xl border border-teal-100 bg-teal-50/60 p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-white text-teal-600">
                  <PackagePlus className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Existencia inicial
                  </p>
                  <p className="text-xs text-slate-500">
                    Opcionalmente registra el primer lote ahora.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <ClinicalField label="Cantidad inicial">
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={form.initialStock}
                    onChange={(event) =>
                      update('initialStock', event.target.value)
                    }
                    className={clinicalInputClass}
                  />
                </ClinicalField>
                <ClinicalField label="Número de lote" optional>
                  <input
                    value={form.batchNumber}
                    onChange={(event) =>
                      update('batchNumber', event.target.value)
                    }
                    placeholder="LOTE-2026-01"
                    className={clinicalInputClass}
                  />
                </ClinicalField>
                <ClinicalField label="Fecha de vencimiento" optional>
                  <input
                    type="date"
                    value={form.expirationDate}
                    onChange={(event) =>
                      update('expirationDate', event.target.value)
                    }
                    className={clinicalInputClass}
                  />
                </ClinicalField>
              </div>
              <div className="mt-4">
                <ClinicalField label="Nota del inventario inicial" optional>
                  <input
                    value={form.notes}
                    onChange={(event) => update('notes', event.target.value)}
                    placeholder="Origen o detalle de la existencia inicial"
                    className={clinicalInputClass}
                  />
                </ClinicalField>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <Button
              onClick={onClose}
              disabled={submitting}
              className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-teal-600 text-white hover:bg-teal-700"
            >
              {submitting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Guardar producto
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function InventoryMovementFormModal({
  product,
  submitting,
  onClose,
  onSubmit,
}: {
  product: InventoryProduct;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (form: InventoryMovementFormState) => Promise<void>;
}) {
  const [form, setForm] = useState<InventoryMovementFormState>({
    type: 'PURCHASE',
    quantity: '',
    unitCost: product.purchasePrice?.toString() ?? '',
    batchId: '',
    batchNumber: '',
    expirationDate: '',
    referenceType: '',
    referenceId: '',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);
  const inbound = inboundTypes.has(form.type);
  const availableBatches = product.batches.filter(
    (batch) => batch.currentQuantity > 0,
  );

  useEffect(() => {
    if (inbound) {
      setForm((current) => ({ ...current, batchId: '' }));
    } else {
      setForm((current) => ({
        ...current,
        batchNumber: '',
        expirationDate: '',
      }));
    }
  }, [inbound]);

  const update = (field: keyof InventoryMovementFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const quantity = Number(form.quantity);
    if (!quantity || quantity <= 0) {
      setError('Ingresa una cantidad mayor que cero.');
      return;
    }
    if (!inbound && quantity > product.currentStock) {
      setError(
        `La cantidad supera el stock disponible de ${product.currentStock} ${product.unit}.`,
      );
      return;
    }
    try {
      await onSubmit(form);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No fue posible registrar el movimiento.',
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/45 p-6 backdrop-blur-sm">
      <Card className="w-full max-w-3xl p-6">
        <ClinicalModalHeader
          eyebrow="Control de existencias"
          title={`Movimiento · ${product.name}`}
          onClose={onClose}
        />
        <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
          <span className="text-xs font-semibold text-slate-500">
            Stock disponible
          </span>
          <span className="text-sm font-bold text-slate-900">
            {product.currentStock} {product.unit}
          </span>
        </div>
        <form onSubmit={(event) => void submit(event)} className="mt-5">
          {error && (
            <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <ClinicalField label="Tipo de movimiento">
              <select
                value={form.type}
                onChange={(event) =>
                  update(
                    'type',
                    event.target.value as InventoryMovementType,
                  )
                }
                className={clinicalInputClass}
              >
                {Object.entries(movementLabels).map(([type, label]) => (
                  <option key={type} value={type}>
                    {label}
                  </option>
                ))}
              </select>
            </ClinicalField>
            <ClinicalField label={`Cantidad (${product.unit})`}>
              <input
                autoFocus
                type="number"
                min="0.001"
                step="0.001"
                required
                value={form.quantity}
                onChange={(event) => update('quantity', event.target.value)}
                className={clinicalInputClass}
              />
            </ClinicalField>
          </div>

          {inbound ? (
            <div className="mt-4 grid grid-cols-3 gap-4">
              <ClinicalField label="Costo unitario" optional>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitCost}
                  onChange={(event) =>
                    update('unitCost', event.target.value)
                  }
                  className={clinicalInputClass}
                />
              </ClinicalField>
              <ClinicalField label="Número de lote" optional>
                <input
                  value={form.batchNumber}
                  onChange={(event) =>
                    update('batchNumber', event.target.value)
                  }
                  placeholder="LOTE-2026-01"
                  className={clinicalInputClass}
                />
              </ClinicalField>
              <ClinicalField label="Vencimiento" optional>
                <input
                  type="date"
                  min={format(new Date(), 'yyyy-MM-dd')}
                  value={form.expirationDate}
                  onChange={(event) =>
                    update('expirationDate', event.target.value)
                  }
                  className={clinicalInputClass}
                />
              </ClinicalField>
            </div>
          ) : (
            <div className="mt-4">
              <ClinicalField label="Lote a descontar" optional>
                <select
                  value={form.batchId}
                  onChange={(event) => update('batchId', event.target.value)}
                  className={clinicalInputClass}
                >
                  <option value="">
                    Automático: usar primero el lote más próximo a vencer
                  </option>
                  {availableBatches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.batchNumber || 'Sin número'} ·{' '}
                      {batch.currentQuantity} {product.unit}
                      {batch.expirationDate
                        ? ` · vence ${formatDateOnly(batch.expirationDate)}`
                        : ''}
                    </option>
                  ))}
                </select>
              </ClinicalField>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-4">
            <ClinicalField label="Tipo de referencia" optional>
              <input
                value={form.referenceType}
                onChange={(event) =>
                  update('referenceType', event.target.value)
                }
                placeholder="Factura, consulta, venta..."
                className={clinicalInputClass}
              />
            </ClinicalField>
            <ClinicalField label="Número de referencia" optional>
              <input
                value={form.referenceId}
                onChange={(event) =>
                  update('referenceId', event.target.value)
                }
                placeholder="FAC-0001"
                className={clinicalInputClass}
              />
            </ClinicalField>
          </div>
          <div className="mt-4">
            <ClinicalField label="Observaciones" optional>
              <textarea
                value={form.notes}
                onChange={(event) => update('notes', event.target.value)}
                placeholder="Motivo o detalle del movimiento"
                className={`${clinicalInputClass} min-h-24 resize-none py-3`}
              />
            </ClinicalField>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button
              onClick={onClose}
              disabled={submitting}
              className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className={
                inbound
                  ? 'bg-teal-600 text-white hover:bg-teal-700'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }
            >
              {submitting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : inbound ? (
                <ArrowDownToLine className="size-4" />
              ) : (
                <ArrowUpFromLine className="size-4" />
              )}
              Registrar movimiento
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function isInboundInventoryMovement(type: InventoryMovementType) {
  return inboundTypes.has(type);
}

export function inventoryMovementLabel(type: InventoryMovementType) {
  return movementLabels[type];
}

function formatDateOnly(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('es-EC').format(
    new Date(year, month - 1, day),
  );
}
