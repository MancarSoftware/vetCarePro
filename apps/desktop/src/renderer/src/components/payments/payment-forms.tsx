import {
  ClinicalField,
  ClinicalModalHeader,
  clinicalInputClass,
} from '@/components/clinical/clinical-ui';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type {
  Appointment,
  InventoryProduct,
  Owner,
  PaymentItemType,
  PaymentMethod,
} from '@/types/clinical';
import { format } from 'date-fns';
import {
  CircleDollarSign,
  LoaderCircle,
  PackagePlus,
  Plus,
  ReceiptText,
  Save,
  Trash2,
  Wrench,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

export interface PaymentLineForm {
  key: string;
  type: PaymentItemType;
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
}

export interface PaymentFormState {
  walkInSale: boolean;
  ownerId: string;
  petId: string;
  appointmentId: string;
  reference: string;
  dueAt: string;
  notes: string;
  items: PaymentLineForm[];
  initialAmount: string;
  method: PaymentMethod;
  paymentReference: string;
}

export interface PaymentTransactionFormState {
  amount: string;
  method: PaymentMethod;
  reference: string;
  notes: string;
  receivedAt: string;
}

const methodLabels: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  BANK_TRANSFER: 'Transferencia',
  CARD: 'Tarjeta',
  CARD_DEBIT: 'Tarjeta debito',
  CARD_CREDIT: 'Tarjeta credito',
  OTHER: 'Otro',
};

const paymentMethodOptions: Array<{
  value: PaymentMethod;
  label: string;
}> = [
  { value: 'CASH', label: methodLabels.CASH },
  { value: 'BANK_TRANSFER', label: methodLabels.BANK_TRANSFER },
  { value: 'CARD_DEBIT', label: methodLabels.CARD_DEBIT },
  { value: 'CARD_CREDIT', label: methodLabels.CARD_CREDIT },
  { value: 'OTHER', label: methodLabels.OTHER },
];

const billableAppointmentStatuses = ['CONFIRMED', 'COMPLETED'] as const;

const appointmentStatusLabels: Record<string, string> = {
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Atendida',
};

const appointmentTypeLabels: Record<Appointment['type'], string> = {
  GENERAL_CONSULTATION: 'Consulta general',
  VACCINATION: 'Vacunación',
  FOLLOW_UP: 'Control',
  SURGERY: 'Cirugía',
  GROOMING: 'Baño y peluquería',
  EMERGENCY: 'Emergencia',
  DEWORMING: 'Desparasitación',
  OTHER: 'Servicio veterinario',
};

function isManualCardMethod(method: PaymentMethod) {
  return (
    method === 'CARD' ||
    method === 'CARD_DEBIT' ||
    method === 'CARD_CREDIT'
  );
}

function normalizeDiscountPercent(value: string) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.min(100, Math.max(0, Math.trunc(numericValue)));
}

function sanitizeDiscountPercent(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return String(Math.min(100, Number(digits)));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function newLine(type: PaymentItemType): PaymentLineForm {
  return {
    key: crypto.randomUUID(),
    type,
    productId: '',
    description: '',
    quantity: '1',
    unitPrice: '',
    discount: '0',
  };
}

function lineFromAppointment(appointment: Appointment): PaymentLineForm {
  return {
    ...newLine('SERVICE'),
    description: appointmentTypeLabels[appointment.type],
    quantity: '1',
    unitPrice:
      appointment.estimatedPrice !== null
        ? String(Number(appointment.estimatedPrice))
        : '',
    discount: '0',
  };
}

export function PaymentFormModal({
  owners,
  appointments,
  initialAppointmentId,
  products,
  submitting,
  onClose,
  onSubmit,
}: {
  owners: Owner[];
  appointments: Appointment[];
  initialAppointmentId?: string;
  products: InventoryProduct[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (form: PaymentFormState) => Promise<void>;
}) {
  const initialAppointment = initialAppointmentId
    ? appointments.find((appointment) => appointment.id === initialAppointmentId)
    : undefined;
  const [form, setForm] = useState<PaymentFormState>(() => ({
    walkInSale: false,
    ownerId: initialAppointment?.ownerId ?? '',
    petId: initialAppointment?.petId ?? '',
    appointmentId: initialAppointment?.id ?? '',
    reference: '',
    dueAt: '',
    notes: '',
    items: initialAppointment
      ? [lineFromAppointment(initialAppointment)]
      : [newLine('SERVICE')],
    initialAmount: '',
    method: 'CASH',
    paymentReference: '',
  }));
  const [error, setError] = useState<string | null>(null);
  const owner = owners.find((item) => item.id === form.ownerId);
  const ownerAppointments = appointments.filter(
    (appointment) =>
      appointment.ownerId === form.ownerId &&
      billableAppointmentStatuses.includes(
        appointment.status as (typeof billableAppointmentStatuses)[number],
      ) &&
      (!form.petId || appointment.petId === form.petId),
  );
  const totals = useMemo(() => calculateFormTotals(form.items), [form.items]);

  const update = <K extends keyof PaymentFormState>(
    field: K,
    value: PaymentFormState[K],
  ) => setForm((current) => ({ ...current, [field]: value }));

  const updateLine = (
    key: string,
    field: keyof PaymentLineForm,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.key !== key) return item;
        if (field === 'productId') {
          const product = products.find((entry) => entry.id === value);
          return {
            ...item,
            productId: value,
            description: product?.name ?? '',
            unitPrice: product?.salePrice?.toString() ?? '',
          };
        }
        if (field === 'discount') {
          return { ...item, discount: sanitizeDiscountPercent(value) };
        }
        return { ...item, [field]: value };
      }),
    }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!form.walkInSale && !form.ownerId) {
      setError('Selecciona el cliente responsable.');
      return;
    }
    if (form.walkInSale && form.items.some((item) => item.type !== 'PRODUCT')) {
      setError('La venta mostrador solo puede contener productos.');
      return;
    }
    if (
      !form.walkInSale &&
      form.appointmentId &&
      !ownerAppointments.some(
        (appointment) => appointment.id === form.appointmentId,
      )
    ) {
      setError('Solo puedes cobrar citas confirmadas o atendidas.');
      return;
    }
    if (
      form.items.some(
        (item) =>
          !item.description.trim() ||
          (item.type === 'PRODUCT' && Number(item.quantity) <= 0) ||
          Number(item.unitPrice) < 0 ||
          !Number.isInteger(Number(item.discount || 0)) ||
          normalizeDiscountPercent(item.discount) !==
            Number(item.discount || 0) ||
          (item.type === 'PRODUCT' && !item.productId),
      )
    ) {
      setError(
        'Completa correctamente todos los conceptos. El descuento debe ser un porcentaje entero entre 0 y 100.',
      );
      return;
    }
    if (totals.total <= 0) {
      setError('El total del documento debe ser mayor que cero.');
      return;
    }
    if (Number(form.initialAmount || 0) > totals.total) {
      setError('El pago inicial no puede superar el total.');
      return;
    }
    if (
      (form.walkInSale ? totals.total : Number(form.initialAmount || 0)) > 0 &&
      isManualCardMethod(form.method) &&
      !form.paymentReference.trim()
    ) {
      setError('Registra la referencia o voucher del pago con tarjeta.');
      return;
    }
    try {
      await onSubmit(
        form.walkInSale
          ? { ...form, initialAmount: totals.total.toFixed(2) }
          : form,
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No fue posible guardar el documento.',
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-6 backdrop-blur-sm">
      <Card className="max-h-[94vh] w-full max-w-6xl overflow-y-auto p-6">
        <ClinicalModalHeader
          eyebrow="Caja y facturación"
          title="Nuevo documento de cobro"
          onClose={onClose}
        />
        <form onSubmit={(event) => void submit(event)} className="mt-6">
          {error && (
            <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          )}

          <div className="mb-5 rounded-2xl border border-teal-100 bg-teal-50/70 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={form.walkInSale}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setForm((current) => ({
                    ...current,
                    walkInSale: checked,
                    ownerId: checked ? '' : current.ownerId,
                    petId: '',
                    appointmentId: '',
                    dueAt: checked ? '' : current.dueAt,
                    items: checked ? [newLine('PRODUCT')] : current.items,
                    initialAmount: checked ? '' : current.initialAmount,
                  }));
                }}
                className="mt-1 size-4 accent-teal-600"
              />
              <span>
                <span className="block text-sm font-black text-slate-900">
                  Venta mostrador / consumidor final
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  Usar para productos vendidos al momento sin registrar un cliente real. Se guarda como pagado y descuenta inventario.
                </span>
              </span>
            </label>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <ClinicalField label="Cliente responsable">
              <select
                required={!form.walkInSale}
                value={form.ownerId}
                disabled={form.walkInSale}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    ownerId: event.target.value,
                    petId: '',
                    appointmentId: '',
                  }))
                }
                className={clinicalInputClass}
              >
                <option value="">
                  {form.walkInSale
                    ? 'Consumidor final automatico'
                    : 'Seleccionar cliente'}
                </option>
                {owners.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.firstName} {item.lastName} · {item.phone}
                  </option>
                ))}
              </select>
            </ClinicalField>
            <ClinicalField label="Mascota" optional>
              <select
                value={form.petId}
                disabled={!owner || form.walkInSale}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    petId: event.target.value,
                    appointmentId: '',
                  }))
                }
                className={clinicalInputClass}
              >
                <option value="">Sin paciente asociado</option>
                {owner?.pets.map((pet) => (
                  <option key={pet.id} value={pet.id}>
                    {pet.name} · {pet.species}
                  </option>
                ))}
              </select>
            </ClinicalField>
            <ClinicalField label="Cita relacionada" optional>
              <select
                value={form.appointmentId}
                disabled={!form.ownerId || form.walkInSale}
                onChange={(event) => {
                  const appointment = appointments.find(
                    (item) => item.id === event.target.value,
                  );
                  setForm((current) => ({
                    ...current,
                    appointmentId: event.target.value,
                    petId: appointment?.petId ?? current.petId,
                    items: appointment
                      ? [
                          lineFromAppointment(appointment),
                          ...current.items.filter(
                            (item, index) =>
                              index > 0 ||
                              item.description.trim() ||
                              item.productId,
                          ),
                        ]
                      : current.items,
                  }));
                }}
                className={clinicalInputClass}
              >
                <option value="">Sin cita asociada</option>
                {ownerAppointments.map((appointment) => (
                  <option key={appointment.id} value={appointment.id}>
                    {appointment.pet.name} ·{' '}
                    {format(new Date(appointment.startsAt), 'dd/MM/yyyy HH:mm')}
                    {' · '}
                    {appointmentStatusLabels[appointment.status] ??
                      appointment.status}
                    {appointment.estimatedPrice !== null
                      ? ` · $${Number(appointment.estimatedPrice).toFixed(2)}`
                      : ''}
                  </option>
                ))}
              </select>
              {form.ownerId && ownerAppointments.length === 0 && !form.walkInSale && (
                <p className="mt-2 text-xs text-slate-400">
                  Solo aparecen citas confirmadas o atendidas.
                </p>
              )}
            </ClinicalField>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
              <div>
                <p className="text-sm font-bold text-slate-800">
                  Conceptos del documento
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Servicios, productos y otros cargos.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={form.walkInSale}
                  onClick={() =>
                    update('items', [...form.items, newLine('SERVICE')])
                  }
                  className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                >
                  <Wrench className="size-4" />
                  Servicio
                </Button>
                <Button
                  onClick={() =>
                    update('items', [...form.items, newLine('PRODUCT')])
                  }
                  className="bg-teal-600 text-white hover:bg-teal-700"
                >
                  <PackagePlus className="size-4" />
                  Producto
                </Button>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {form.items.map((item, index) => {
                const line = calculateFormLine(item);
                const isProduct = item.type === 'PRODUCT';
                return (
                  <div
                    key={item.key}
                    className={
                      isProduct
                        ? 'grid grid-cols-[120px_1fr_110px_130px_120px_120px_36px] items-end gap-3 px-5 py-4'
                        : 'grid grid-cols-[120px_1fr_150px_120px_120px_36px] items-end gap-3 px-5 py-4'
                    }
                  >
                    <ClinicalField label="Tipo">
                      <select
                        value={item.type}
                        disabled={form.walkInSale}
                        onChange={(event) => {
                          const type = event.target.value as PaymentItemType;
                          setForm((current) => ({
                            ...current,
                            items: current.items.map((lineItem) =>
                              lineItem.key === item.key
                                ? {
                                    ...newLine(type),
                                    key: item.key,
                                  }
                                : lineItem,
                            ),
                          }));
                        }}
                        className={clinicalInputClass}
                      >
                        <option value="SERVICE">Servicio</option>
                        <option value="PRODUCT">Producto</option>
                        <option value="OTHER">Otro</option>
                      </select>
                    </ClinicalField>
                    {isProduct ? (
                      <ClinicalField label="Producto">
                        <select
                          required
                          value={item.productId}
                          onChange={(event) =>
                            updateLine(
                              item.key,
                              'productId',
                              event.target.value,
                            )
                          }
                          className={clinicalInputClass}
                        >
                          <option value="">Seleccionar producto</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} · {product.currentStock}{' '}
                              {product.unit}
                            </option>
                          ))}
                        </select>
                      </ClinicalField>
                    ) : (
                      <ClinicalField label="Descripción">
                        <input
                          required
                          value={item.description}
                          onChange={(event) =>
                            updateLine(
                              item.key,
                              'description',
                              event.target.value,
                            )
                          }
                          placeholder="Consulta general"
                          className={clinicalInputClass}
                        />
                      </ClinicalField>
                    )}
                    {isProduct && (
                      <ClinicalField label="Cantidad">
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          required
                          value={item.quantity}
                          onChange={(event) =>
                            updateLine(
                              item.key,
                              'quantity',
                              event.target.value,
                            )
                          }
                          className={clinicalInputClass}
                        />
                      </ClinicalField>
                    )}
                    <ClinicalField
                      label={isProduct ? 'Precio unitario' : 'Precio'}
                    >
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={item.unitPrice}
                        onChange={(event) =>
                          updateLine(
                            item.key,
                            'unitPrice',
                            event.target.value,
                          )
                        }
                        className={clinicalInputClass}
                      />
                    </ClinicalField>
                    <ClinicalField label="Descuento %">
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={3}
                          value={item.discount}
                          onChange={(event) =>
                            updateLine(
                              item.key,
                              'discount',
                              event.target.value,
                            )
                          }
                          className={`${clinicalInputClass} pr-8`}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          %
                        </span>
                      </div>
                    </ClinicalField>
                    <div className="pb-3 text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Total
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {currency(line.total)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={form.items.length === 1}
                      onClick={() =>
                        update(
                          'items',
                          form.items.filter((entry) => entry.key !== item.key),
                        )
                      }
                      title={`Eliminar concepto ${index + 1}`}
                      className="mb-1 grid size-9 place-items-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-[1fr_380px] gap-5">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <ClinicalField label="Referencia externa" optional>
                  <input
                    value={form.reference}
                    onChange={(event) =>
                      update('reference', event.target.value)
                    }
                    placeholder="Orden, convenio..."
                    className={clinicalInputClass}
                  />
                </ClinicalField>
                <ClinicalField label="Fecha límite de pago" optional>
                  <input
                    type="date"
                    value={form.dueAt}
                    onChange={(event) => update('dueAt', event.target.value)}
                    className={clinicalInputClass}
                  />
                </ClinicalField>
              </div>
              <ClinicalField label="Observaciones" optional>
                <textarea
                  value={form.notes}
                  onChange={(event) => update('notes', event.target.value)}
                  placeholder="Condiciones, detalle o nota interna..."
                  className={`${clinicalInputClass} min-h-24 resize-none py-3`}
                />
              </ClinicalField>
            </div>

            <div className="rounded-2xl bg-slate-950 p-5 text-white">
              <div className="space-y-2 border-b border-white/10 pb-4 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span>{currency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Descuentos</span>
                  <span>- {currency(totals.discount)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{currency(totals.total)}</span>
                </div>
              </div>
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-teal-300">
                {form.walkInSale ? 'Pago de venta mostrador' : 'Pago inicial opcional'}
              </p>
              {form.walkInSale && (
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Se registrara pagada por el total del documento.
                </p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min="0"
                  max={totals.total}
                  step="0.01"
                  disabled={form.walkInSale}
                  value={
                    form.walkInSale && totals.total > 0
                      ? totals.total.toFixed(2)
                      : form.initialAmount
                  }
                  onChange={(event) =>
                    update('initialAmount', event.target.value)
                  }
                  placeholder="Monto"
                  className="h-10 rounded-xl border border-white/10 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-teal-400"
                />
                <select
                  value={form.method}
                  onChange={(event) =>
                    update('method', event.target.value as PaymentMethod)
                  }
                  className="h-10 rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-white outline-none"
                >
                  {paymentMethodOptions.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <input
                required={
                  Number(form.initialAmount || 0) > 0 &&
                  isManualCardMethod(form.method)
                }
                value={form.paymentReference}
                onChange={(event) =>
                  update('paymentReference', event.target.value)
                }
                placeholder={
                  isManualCardMethod(form.method)
                    ? 'Voucher o referencia de tarjeta'
                    : 'Referencia del pago'
                }
                className="mt-3 h-10 w-full rounded-xl border border-white/10 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-teal-400"
              />
              {isManualCardMethod(form.method) && (
                <p className="mt-2 text-xs text-teal-100">
                  La tarjeta se cobra en el POS/datafono y aqui se guarda el
                  voucher.
                </p>
              )}
            </div>
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
              className="h-10 bg-teal-600 px-5 text-white hover:bg-teal-700"
            >
              {submitting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <ReceiptText className="size-4" />
              )}
              Crear documento
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function PaymentTransactionModal({
  balance,
  submitting,
  onClose,
  onSubmit,
}: {
  balance: number;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (form: PaymentTransactionFormState) => Promise<void>;
}) {
  const [form, setForm] = useState<PaymentTransactionFormState>({
    amount: balance.toFixed(2),
    method: 'CASH',
    reference: '',
    notes: '',
    receivedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const amount = Number(form.amount);
    if (!amount || amount <= 0 || amount > balance) {
      setError(`Ingresa un valor entre 0,01 y ${currency(balance)}.`);
      return;
    }
    if (isManualCardMethod(form.method) && !form.reference.trim()) {
      setError('Registra la referencia o voucher del pago con tarjeta.');
      return;
    }
    try {
      await onSubmit(form);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No fue posible registrar el abono.',
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/45 p-6 backdrop-blur-sm">
      <Card className="w-full max-w-xl p-6">
        <ClinicalModalHeader
          eyebrow="Ingreso de caja"
          title="Registrar abono"
          onClose={onClose}
        />
        <form onSubmit={(event) => void submit(event)} className="mt-6">
          {error && (
            <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          )}
          <div className="mb-5 flex items-center justify-between rounded-xl bg-teal-50 px-4 py-3">
            <span className="text-xs font-semibold text-teal-700">
              Saldo pendiente
            </span>
            <span className="text-lg font-bold text-teal-800">
              {currency(balance)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ClinicalField label="Monto">
              <input
                autoFocus
                type="number"
                min="0.01"
                max={balance}
                step="0.01"
                required
                value={form.amount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
                className={clinicalInputClass}
              />
            </ClinicalField>
            <ClinicalField label="Método">
              <select
                value={form.method}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    method: event.target.value as PaymentMethod,
                  }))
                }
                className={clinicalInputClass}
              >
                {paymentMethodOptions.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </ClinicalField>
            <ClinicalField label="Fecha y hora">
              <input
                type="datetime-local"
                required
                value={form.receivedAt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    receivedAt: event.target.value,
                  }))
                }
                className={clinicalInputClass}
              />
            </ClinicalField>
            <ClinicalField
              label="Referencia / voucher"
              optional={!isManualCardMethod(form.method)}
            >
              <input
                required={isManualCardMethod(form.method)}
                value={form.reference}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    reference: event.target.value,
                  }))
                }
                placeholder={
                  isManualCardMethod(form.method)
                    ? 'Voucher aprobado por el POS'
                    : 'Transferencia, voucher...'
                }
                className={clinicalInputClass}
              />
            </ClinicalField>
          </div>
          <div className="mt-4">
            <ClinicalField label="Observación" optional>
              <textarea
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                className={`${clinicalInputClass} min-h-20 resize-none py-3`}
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
              className="bg-teal-600 text-white hover:bg-teal-700"
            >
              {submitting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <CircleDollarSign className="size-4" />
              )}
              Registrar abono
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function paymentMethodLabel(method: PaymentMethod) {
  return methodLabels[method];
}

export function calculateFormLine(item: PaymentLineForm) {
  const quantity = item.type === 'PRODUCT' ? Number(item.quantity || 0) : 1;
  const subtotal = roundMoney(quantity * Number(item.unitPrice || 0));
  const discountPercent = normalizeDiscountPercent(item.discount);
  const discount = roundMoney((subtotal * discountPercent) / 100);
  return {
    subtotal,
    discount,
    total: roundMoney(Math.max(0, subtotal - discount)),
  };
}

function calculateFormTotals(items: PaymentLineForm[]) {
  return items.reduce(
    (totals, item) => {
      const line = calculateFormLine(item);
      return {
        subtotal: totals.subtotal + line.subtotal,
        discount: totals.discount + line.discount,
        total: totals.total + line.total,
      };
    },
    { subtotal: 0, discount: 0, total: 0 },
  );
}

function currency(value: number) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}
