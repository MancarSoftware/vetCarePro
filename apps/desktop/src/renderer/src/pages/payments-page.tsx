import { ClinicalConfirmDialog, clinicalInputClass } from '@/components/clinical/clinical-ui';
import {
  PaymentFormModal,
  PaymentTransactionModal,
  calculateFormLine,
  paymentMethodLabel,
  type PaymentFormState,
  type PaymentTransactionFormState,
} from '@/components/payments/payment-forms';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import type { ApiRequestOptions } from '@/lib/api';
import { cn } from '@/lib/utils';
import type {
  Appointment,
  InventoryProduct,
  Owner,
  PaginatedResponse,
  Payment,
  PaymentStatus,
  PaymentSummary,
  SriInvoice,
} from '@/types/clinical';
import { format, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Download,
  FileCheck2,
  FileText,
  KeyRound,
  LoaderCircle,
  PawPrint,
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  Search,
  Send,
  ShieldX,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';

const currency = new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
});

const emptySummary: PaymentSummary = {
  totalDocuments: 0,
  pendingDocuments: 0,
  overdueDocuments: 0,
  outstanding: 0,
  collectedToday: 0,
  collectedMonth: 0,
};

type ApiRequest = <T>(
  path: string,
  options?: ApiRequestOptions,
) => Promise<T>;

const statusPresentation: Record<
  PaymentStatus,
  { label: string; className: string; icon: LucideIcon }
> = {
  PAID: {
    label: 'Pagado',
    className: 'bg-emerald-50 text-emerald-700',
    icon: CheckCircle2,
  },
  PARTIAL: {
    label: 'Parcial',
    className: 'bg-blue-50 text-blue-700',
    icon: WalletCards,
  },
  PENDING: {
    label: 'Pendiente',
    className: 'bg-amber-50 text-amber-700',
    icon: CalendarClock,
  },
  VOIDED: {
    label: 'Anulado',
    className: 'bg-slate-100 text-slate-500',
    icon: ShieldX,
  },
};

interface PaymentsPageProps {
  initialAppointmentId?: string;
  onInitialAppointmentHandled?: () => void;
}

export function PaymentsPage({
  initialAppointmentId,
  onInitialAppointmentHandled,
}: PaymentsPageProps = {}) {
  const { request, user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState(emptySummary);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isReferencesLoading, setIsReferencesLoading] = useState(true);
  const [referencesError, setReferencesError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [prefillAppointmentId, setPrefillAppointmentId] = useState<string>();
  const [detailPayment, setDetailPayment] = useState<Payment | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isTransactionOpen, setIsTransactionOpen] = useState(false);
  const [voidingPayment, setVoidingPayment] = useState<Payment | null>(null);
  const canManage =
    user?.permissions.includes('payments.manage') ?? false;

  const loadPayments = useCallback(async () => {
    const query = new URLSearchParams({
      page: '1',
      pageSize: '100',
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    });
    const [list, summaryData] = await Promise.all([
      request<PaginatedResponse<Payment>>(
        `/payments?${query.toString()}`,
      ),
      request<PaymentSummary>('/payments/summary'),
    ]);
    setPayments(list.items);
    setSummary(summaryData);
  }, [request, search, statusFilter]);

  const loadReferences = useCallback(async () => {
    setIsReferencesLoading(true);
    setReferencesError(null);
    const [
      ownerResult,
      confirmedAppointmentResult,
      completedAppointmentResult,
      productResult,
    ] =
      await Promise.allSettled([
        request<PaginatedResponse<Owner>>('/owners?page=1&pageSize=100'),
        request<PaginatedResponse<Appointment>>(
          '/appointments?page=1&pageSize=300&status=CONFIRMED',
        ),
        request<PaginatedResponse<Appointment>>(
          '/appointments?page=1&pageSize=300&status=COMPLETED',
        ),
        user?.permissions.includes('inventory.read')
          ? request<PaginatedResponse<InventoryProduct>>(
              '/inventory/products?page=1&pageSize=100&stockStatus=ALL',
            )
          : Promise.resolve({
              items: [],
              total: 0,
              page: 1,
              pageSize: 100,
              totalPages: 1,
            }),
      ]);
    const issues: string[] = [];

    if (ownerResult.status === 'fulfilled') {
      setOwners(ownerResult.value.items);
    } else {
      setOwners([]);
      issues.push(
        'No se pudieron cargar los dueños/clientes. Verifica que Caja tenga permiso para leer dueños y que esté conectado al servidor correcto.',
      );
    }

    const appointmentItems = [
      ...(confirmedAppointmentResult.status === 'fulfilled'
        ? confirmedAppointmentResult.value.items
        : []),
      ...(completedAppointmentResult.status === 'fulfilled'
        ? completedAppointmentResult.value.items
        : []),
    ].filter(
      (appointment, index, all) =>
        all.findIndex((item) => item.id === appointment.id) === index,
    );
    setAppointments(appointmentItems);
    if (
      confirmedAppointmentResult.status === 'rejected' &&
      completedAppointmentResult.status === 'rejected'
    ) {
      setAppointments([]);
      issues.push('No se pudieron cargar las citas para asociarlas al cobro.');
    }

    if (productResult.status === 'fulfilled') {
      setProducts(productResult.value.items);
    } else {
      setProducts([]);
      issues.push(
        'No se pudo cargar inventario. Puedes seguir cobrando servicios, pero no productos.',
      );
    }

    setReferencesError(issues.length ? issues.join(' ') : null);
    setIsReferencesLoading(false);
  }, [request, user?.permissions]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await loadPayments();
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No fue posible cargar los pagos.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [loadPayments]);

  const openCreatePayment = async () => {
    setError(null);
    setIsReferencesLoading(true);
    await loadReferences();
    setPrefillAppointmentId(undefined);
    setIsFormOpen(true);
  };

  useEffect(() => {
    void loadReferences();
  }, [loadReferences]);

  useEffect(() => {
    if (!initialAppointmentId || isReferencesLoading) return;
    let cancelled = false;

    const openFromAppointment = async () => {
      let appointment = appointments.find(
        (item) => item.id === initialAppointmentId,
      );
      if (!appointment) {
        try {
          appointment = await request<Appointment>(
            `/appointments/${initialAppointmentId}`,
          );
          if (!cancelled) {
            setAppointments((current) =>
              current.some((item) => item.id === appointment?.id)
                ? current
                : appointment
                  ? [appointment, ...current]
                  : current,
            );
          }
        } catch {
          if (!cancelled) {
            setError(
              'No se encontro la cita seleccionada para generar el cobro. Actualiza caja e intenta nuevamente.',
            );
            onInitialAppointmentHandled?.();
          }
          return;
        }
      }

      if (cancelled) return;
      setError(null);
      setPrefillAppointmentId(initialAppointmentId);
      setIsFormOpen(true);
      onInitialAppointmentHandled?.();
    };

    void openFromAppointment();
    return () => {
      cancelled = true;
    };
  }, [
    appointments,
    initialAppointmentId,
    isReferencesLoading,
    onInitialAppointmentHandled,
    request,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 180);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const openDetail = async (paymentId: string) => {
    setIsDetailLoading(true);
    try {
      setDetailPayment(
        await request<Payment>(`/payments/${paymentId}`),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No fue posible abrir el documento.',
      );
    } finally {
      setIsDetailLoading(false);
    }
  };

  const refreshDetail = async (paymentId: string) => {
    setDetailPayment(await request<Payment>(`/payments/${paymentId}`));
  };

  const submitPayment = async (form: PaymentFormState) => {
    setIsSubmitting(true);
    const optional = (value: string) => value.trim() || undefined;
    try {
      const payment = await request<Payment>('/payments', {
        method: 'POST',
        body: {
          ownerId: optional(form.ownerId),
          walkInCustomerName: form.walkInSale
            ? optional(form.walkInCustomerName)
            : undefined,
          walkInCustomerPhone: form.walkInSale
            ? optional(form.walkInCustomerPhone)
            : undefined,
          walkInCustomerDocument: form.walkInSale
            ? optional(form.walkInCustomerDocument)
            : undefined,
          petId: optional(form.petId),
          appointmentId: optional(form.appointmentId),
          reference: optional(form.reference),
          dueAt: form.dueAt
            ? new Date(`${form.dueAt}T12:00:00`).toISOString()
            : undefined,
          notes: optional(form.notes),
          items: form.items.map((item) => ({
            type: item.type,
            productId:
              item.type === 'PRODUCT'
                ? item.productId
                : undefined,
            description: item.description.trim(),
            quantity:
              item.type === 'PRODUCT' ? Number(item.quantity) : 1,
            unitPrice: Number(item.unitPrice),
            discount: calculateFormLine(item).discount,
          })),
          ...(Number(form.initialAmount || 0) > 0
            ? {
                initialPayment: {
                  amount: Number(form.initialAmount),
                  method: form.method,
                  reference: optional(form.paymentReference),
                },
              }
            : {}),
        },
      });
      setIsFormOpen(false);
      setPrefillAppointmentId(undefined);
      await refresh();
      setDetailPayment(payment);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitTransaction = async (
    form: PaymentTransactionFormState,
  ) => {
    if (!detailPayment) return;
    setIsSubmitting(true);
    try {
      await request(`/payments/${detailPayment.id}/transactions`, {
        method: 'POST',
        body: {
          amount: Number(form.amount),
          method: form.method,
          reference: form.reference.trim() || undefined,
          notes: form.notes.trim() || undefined,
          receivedAt: new Date(form.receivedAt).toISOString(),
        },
      });
      setIsTransactionOpen(false);
      await Promise.all([
        refreshDetail(detailPayment.id),
        refresh(),
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const voidPayment = async () => {
    if (!voidingPayment) return;
    setIsSubmitting(true);
    try {
      await request(`/payments/${voidingPayment.id}/void`, {
        method: 'POST',
      });
      setVoidingPayment(null);
      await Promise.all([
        refreshDetail(voidingPayment.id),
        refresh(),
      ]);
    } catch (voidError) {
      setVoidingPayment(null);
      setError(
        voidError instanceof Error
          ? voidError.message
          : 'No fue posible anular el documento.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">
            Caja y cuentas por cobrar
          </p>
          <h1 className="mt-2 text-[28px] font-bold tracking-[-0.04em] text-slate-950">
            Pagos
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Documentos, abonos, saldos y ventas de la clínica.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              if (isReferencesLoading) {
                setError(
                  'VetCare Pro todavia esta cargando clientes, citas e inventario para caja. Intenta nuevamente en unos segundos.',
                );
                return;
              }
              void openCreatePayment();
            }}
            disabled={isReferencesLoading}
            className="h-10 bg-teal-600 px-4 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700"
          >
            {isReferencesLoading ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {isReferencesLoading ? 'Cargando caja...' : 'Nuevo cobro'}
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
        <PaymentMetric
          icon={CircleDollarSign}
          label="Cobrado este mes"
          value={currency.format(summary.collectedMonth)}
          tone="teal"
        />
        <PaymentMetric
          icon={Banknote}
          label="Cobrado hoy"
          value={currency.format(summary.collectedToday)}
          tone="blue"
        />
        <PaymentMetric
          icon={WalletCards}
          label="Saldo por cobrar"
          value={currency.format(summary.outstanding)}
          tone="amber"
        />
        <PaymentMetric
          icon={CalendarClock}
          label="Documentos pendientes"
          value={summary.pendingDocuments.toString()}
          tone="violet"
        />
        <PaymentMetric
          icon={AlertTriangle}
          label="Cuentas vencidas"
          value={summary.overdueDocuments.toString()}
          tone="rose"
        />
      </section>

      <Card className="mt-4 overflow-hidden">
        <div className="grid grid-cols-[1fr_240px] gap-3 border-b border-slate-100 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar documento, cliente, mascota o referencia..."
              className={`${clinicalInputClass} pl-10`}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={clinicalInputClass}
          >
            <option value="">Todos los estados</option>
            <option value="PAID">Pagados</option>
            <option value="PARTIAL">Parciales</option>
            <option value="PENDING">Pendientes</option>
            <option value="VOIDED">Anulados</option>
          </select>
        </div>

        {isLoading ? (
          <div className="space-y-px">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-[82px] animate-pulse border-t border-slate-100 bg-slate-50/60"
              />
            ))}
          </div>
        ) : payments.length ? (
          <PaymentsTable payments={payments} onOpen={openDetail} />
        ) : (
          <div className="grid min-h-[390px] place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-teal-50 text-teal-600">
                <ReceiptText className="size-8" />
              </div>
              <h2 className="mt-5 text-lg font-bold text-slate-900">
                No hay documentos de cobro
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Los pagos, ventas y saldos pendientes aparecerán aquí.
              </p>
            </div>
          </div>
        )}
      </Card>

      {isFormOpen && (
        <PaymentFormModal
          owners={owners}
          appointments={appointments}
          initialAppointmentId={prefillAppointmentId}
          products={products}
          submitting={isSubmitting}
          onClose={() => {
            setIsFormOpen(false);
            setPrefillAppointmentId(undefined);
          }}
          onSubmit={submitPayment}
        />
      )}

      {detailPayment && (
        <PaymentDetailModal
          payment={detailPayment}
          canManage={canManage}
          request={request}
          onClose={() => setDetailPayment(null)}
          onAddPayment={() => setIsTransactionOpen(true)}
          onVoid={() => setVoidingPayment(detailPayment)}
        />
      )}

      {isTransactionOpen && detailPayment && (
        <PaymentTransactionModal
          balance={detailPayment.balance}
          submitting={isSubmitting}
          onClose={() => setIsTransactionOpen(false)}
          onSubmit={submitTransaction}
        />
      )}

      {voidingPayment && (
        <ClinicalConfirmDialog
          title="Anular documento"
          message={`Se anulará ${voidingPayment.invoiceNumber}. Las ventas de productos devolverán automáticamente las existencias al inventario.`}
          disabled={isSubmitting}
          onCancel={() => setVoidingPayment(null)}
          onConfirm={() => void voidPayment()}
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

function PaymentsTable({
  payments,
  onOpen,
}: {
  payments: Payment[];
  onOpen: (paymentId: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50/80 text-slate-400">
          <tr>
            <th className="px-5 py-3 font-semibold">Documento</th>
            <th className="px-4 py-3 font-semibold">Cliente</th>
            <th className="px-4 py-3 font-semibold">Concepto</th>
            <th className="px-4 py-3 font-semibold">Total</th>
            <th className="px-4 py-3 font-semibold">Saldo</th>
            <th className="px-4 py-3 font-semibold">Estado</th>
            <th className="px-5 py-3 text-right font-semibold">Detalle</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => {
            const status = statusPresentation[payment.status];
            const customerName =
              payment.walkInCustomerName ||
              `${payment.owner.firstName} ${payment.owner.lastName}`;
            const customerContact =
              payment.walkInCustomerName
                ? payment.walkInCustomerPhone ||
                  payment.walkInCustomerDocument ||
                  'Sin contacto'
                : payment.pet?.name || payment.owner.phone;
            const overdue =
              payment.dueAt &&
              payment.status !== 'PAID' &&
              payment.status !== 'VOIDED' &&
              isBefore(
                new Date(payment.dueAt),
                startOfDay(new Date()),
              );
            return (
              <tr
                key={payment.id}
                className="border-t border-slate-100 transition hover:bg-slate-50/60"
              >
                <td className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => onOpen(payment.id)}
                    className="text-left"
                  >
                    <p className="font-bold text-slate-800">
                      {payment.invoiceNumber}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {format(
                        new Date(payment.createdAt),
                        'dd/MM/yyyy HH:mm',
                      )}
                    </p>
                  </button>
                </td>
                <td className="px-4 py-4">
                  <p className="font-semibold text-slate-700">
                    {customerName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {customerContact}
                  </p>
                </td>
                <td className="max-w-[280px] px-4 py-4">
                  <p className="truncate text-slate-600">
                    {payment.description}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {payment._count.items} concepto(s)
                  </p>
                </td>
                <td className="px-4 py-4 font-bold text-slate-800">
                  {currency.format(payment.amount)}
                </td>
                <td className="px-4 py-4">
                  <p
                    className={cn(
                      'font-bold',
                      payment.balance > 0
                        ? 'text-amber-700'
                        : 'text-emerald-700',
                    )}
                  >
                    {currency.format(payment.balance)}
                  </p>
                  {overdue && (
                    <p className="mt-1 text-[10px] font-bold text-rose-600">
                      Vencido
                    </p>
                  )}
                </td>
                <td className="px-4 py-4">
                  <Badge className={status.className}>{status.label}</Badge>
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => onOpen(payment.id)}
                    className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-700"
                    title="Ver documento"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PaymentDetailModal({
  payment,
  canManage,
  request,
  onClose,
  onAddPayment,
  onVoid,
}: {
  payment: Payment;
  canManage: boolean;
  request: ApiRequest;
  onClose: () => void;
  onAddPayment: () => void;
  onVoid: () => void;
}) {
  const status = statusPresentation[payment.status];
  const StatusIcon = status.icon;
  const [sriAssistantOpen, setSriAssistantOpen] = useState(false);
  const [sriInvoice, setSriInvoice] = useState<SriInvoice | null>(null);
  const [isSriLoading, setIsSriLoading] = useState(false);
  const isSriAuthorized = sriInvoice?.status === 'AUTHORIZED';
  const customerName =
    payment.walkInCustomerName ||
    `${payment.owner.firstName} ${payment.owner.lastName}`;
  const customerContact =
    payment.walkInCustomerName
      ? payment.walkInCustomerPhone || 'Sin telefono'
      : payment.owner.phone;

  const loadSriInvoice = useCallback(async () => {
    setIsSriLoading(true);
    try {
      setSriInvoice(
        await request<SriInvoice>(`/sri-invoices/payment/${payment.id}`),
      );
    } catch {
      setSriInvoice(null);
    } finally {
      setIsSriLoading(false);
    }
  }, [payment.id, request]);

  useEffect(() => {
    void loadSriInvoice();
  }, [loadSriInvoice]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-6 backdrop-blur-sm">
      <Card className="max-h-[94vh] w-full max-w-6xl overflow-y-auto">
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div className="flex items-center gap-4">
            <div className="grid size-14 place-items-center rounded-2xl bg-teal-50 text-teal-600">
              <FileText className="size-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">
                  {payment.invoiceNumber}
                </h2>
                <Badge className={status.className}>
                  <StatusIcon className="mr-1 size-3.5" />
                  {status.label}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Emitido{' '}
                {format(
                  new Date(payment.createdAt),
                  "d 'de' MMMM yyyy, HH:mm",
                  { locale: es },
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => window.print()}
              className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            >
              <Printer className="size-4" />
              Imprimir
            </Button>
            {canManage && payment.status !== 'VOIDED' && (
              <Button
                onClick={() => setSriAssistantOpen(true)}
                className={cn(
                  'border',
                  isSriAuthorized
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100',
                )}
              >
                <FileCheck2 className="size-4" />
                {isSriLoading
                  ? 'Consultando SRI...'
                  : isSriAuthorized
                    ? 'Factura SRI demo'
                    : sriInvoice
                      ? 'Continuar factura SRI'
                      : 'Emitir factura SRI'}
              </Button>
            )}
            {canManage &&
              payment.status !== 'PAID' &&
              payment.status !== 'VOIDED' && (
                <Button
                  onClick={onAddPayment}
                  className="bg-teal-600 text-white hover:bg-teal-700"
                >
                  <CircleDollarSign className="size-4" />
                  Registrar abono
                </Button>
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

        <div className="grid grid-cols-[1.15fr_0.85fr] gap-5 p-6">
          <div className="space-y-4">
            <Card className="overflow-hidden shadow-none">
              <div className="border-b border-slate-100 px-5 py-4">
                <p className="text-sm font-bold text-slate-800">
                  Detalle del documento
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {payment.items.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[1fr_100px_110px_110px] gap-3 px-5 py-4 text-sm"
                  >
                    <div>
                      <p className="font-bold text-slate-700">
                        {item.description}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {item.type === 'PRODUCT'
                          ? `Producto · ${item.product?.sku || 'Sin SKU'}`
                          : item.type === 'SERVICE'
                            ? 'Servicio clínico'
                            : 'Otro concepto'}
                      </p>
                    </div>
                    <p className="text-right text-slate-500">
                      {item.quantity} × {currency.format(item.unitPrice)}
                    </p>
                    <p className="text-right text-slate-400">
                      {item.discount
                        ? `-${currency.format(item.discount)}`
                        : '-'}
                    </p>
                    <p className="text-right font-bold text-slate-800">
                      {currency.format(item.total)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="ml-auto w-80 space-y-2 border-t border-slate-100 px-5 py-4 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span>{currency.format(payment.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Descuentos</span>
                  <span>- {currency.format(payment.discount)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold text-slate-900">
                  <span>Total</span>
                  <span>{currency.format(payment.amount)}</span>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden shadow-none">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Historial de abonos
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {payment.transactions?.length ?? 0} movimientos de caja
                  </p>
                </div>
                <CreditCard className="size-5 text-teal-600" />
              </div>
              {payment.transactions?.length ? (
                <div className="divide-y divide-slate-100">
                  {payment.transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center gap-4 px-5 py-4"
                    >
                      <div className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                        <Banknote className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800">
                          {paymentMethodLabel(transaction.method)}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-400">
                          {transaction.reference || 'Sin referencia'} ·{' '}
                          {transaction.createdBy.firstName}{' '}
                          {transaction.createdBy.lastName}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-700">
                          +{currency.format(transaction.amount)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {format(
                            new Date(transaction.receivedAt),
                            'dd/MM/yyyy HH:mm',
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-10 text-center text-sm text-slate-400">
                  Aún no hay abonos registrados.
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <div
              className={cn(
                'rounded-2xl p-5',
                payment.status === 'VOIDED'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-950 text-white',
              )}
            >
              <p className="text-xs uppercase tracking-wider text-slate-400">
                Saldo pendiente
              </p>
              <p className="mt-2 text-3xl font-bold">
                {currency.format(payment.balance)}
              </p>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-teal-400"
                  style={{
                    width: `${Math.min(
                      100,
                      (payment.paidAmount / payment.amount) * 100,
                    )}%`,
                  }}
                />
              </div>
              <div className="mt-3 flex justify-between text-xs text-slate-400">
                <span>Cobrado {currency.format(payment.paidAmount)}</span>
                <span>Total {currency.format(payment.amount)}</span>
              </div>
            </div>

            <Card className="p-5 shadow-none">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-teal-600">
                Cliente
              </p>
              <DetailRow
                icon={UserRound}
                label="Responsable"
                value={customerName}
              />
              <DetailRow
                icon={CreditCard}
                label="Contacto"
                value={customerContact}
              />
              {payment.walkInCustomerDocument && (
                <DetailRow
                  icon={FileText}
                  label="Documento"
                  value={payment.walkInCustomerDocument}
                />
              )}
              {payment.pet && (
                <DetailRow
                  icon={PawPrint}
                  label="Paciente"
                  value={`${payment.pet.name} · ${payment.pet.breed || payment.pet.species}`}
                />
              )}
              {payment.dueAt && (
                <DetailRow
                  icon={Clock3}
                  label="Fecha límite"
                  value={format(
                    new Date(payment.dueAt),
                    'dd/MM/yyyy',
                  )}
                />
              )}
            </Card>

            {payment.notes && (
              <Card className="p-5 shadow-none">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  Observaciones
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {payment.notes}
                </p>
              </Card>
            )}

            {canManage && payment.status !== 'VOIDED' && (
              <Button
                onClick={onVoid}
                className="w-full border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
              >
                <ShieldX className="size-4" />
                Anular documento
              </Button>
            )}
          </div>
        </div>
      </Card>
      {sriAssistantOpen && (
        <SriInvoiceAssistantModal
          payment={payment}
          request={request}
          sriInvoice={sriInvoice}
          onInvoiceChange={setSriInvoice}
          onReload={() => void loadSriInvoice()}
          onClose={() => setSriAssistantOpen(false)}
        />
      )}
    </div>
  );
}

function SriInvoiceAssistantModal({
  payment,
  request,
  sriInvoice,
  onInvoiceChange,
  onReload,
  onClose,
}: {
  payment: Payment;
  request: ApiRequest;
  sriInvoice: SriInvoice | null;
  onInvoiceChange: (invoice: SriInvoice | null) => void;
  onReload: () => void;
  onClose: () => void;
}) {
  const [isWorking, setIsWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const isAuthorized = sriInvoice?.status === 'AUTHORIZED';
  const customerName =
    sriInvoice?.customerName ||
    payment.walkInCustomerName ||
    `${payment.owner.firstName} ${payment.owner.lastName}`;
  const customerDocument =
    sriInvoice?.customerDocument ||
    payment.walkInCustomerDocument ||
    payment.owner.nationalId ||
    'Consumidor final';
  const customerEmail =
    sriInvoice?.customerEmail ||
    payment.owner.email ||
    (payment.walkInCustomerName ? 'Cliente ocasional sin correo' : 'Sin correo');
  const accessKey = sriInvoice?.accessKey ?? 'Se generará al crear el borrador';
  const hasXml = Boolean(sriInvoice?.xmlPath);
  const steps = [
    {
      label: 'Validar datos tributarios',
      description: `${customerName} · ${customerDocument}`,
      icon: UserRound,
    },
    {
      label: 'Generar XML',
      description: `Factura basada en ${payment.invoiceNumber}`,
      icon: FileText,
    },
    {
      label: 'Firmar XML',
      description: 'Firma electrónica del contribuyente',
      icon: KeyRound,
    },
    {
      label: 'Enviar al SRI',
      description: 'Web service de recepción',
      icon: Send,
    },
    {
      label: 'Consultar autorización',
      description: 'Clave de acceso y número de autorización',
      icon: CheckCircle2,
    },
    {
      label: 'Generar RIDE/PDF',
      description: 'Documento imprimible para el cliente',
      icon: Download,
    },
  ];

  const createDraft = async () => {
    setIsWorking(true);
    setActionError(null);
    try {
      const created = await request<SriInvoice>(
        `/sri-invoices/payment/${payment.id}`,
        { method: 'POST' },
      );
      onInvoiceChange(created);
      return created;
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'No fue posible crear la factura SRI demo.',
      );
      return null;
    } finally {
      setIsWorking(false);
    }
  };

  const authorizeDemo = async () => {
    setIsWorking(true);
    setActionError(null);
    try {
      const draft = sriInvoice;
      if (!draft) {
        setActionError('Primero crea el borrador SRI.');
        return;
      }
      if (!draft.xmlPath) {
        setActionError('Primero genera el XML antes de simular la autorización.');
        return;
      }
      const authorized = await request<SriInvoice>(
        `/sri-invoices/${draft.id}/demo-authorize`,
        { method: 'POST' },
      );
      onInvoiceChange(authorized);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'No fue posible simular la autorización SRI.',
      );
    } finally {
      setIsWorking(false);
    }
  };

  const generateXml = async () => {
    setIsWorking(true);
    setActionError(null);
    try {
      const draft = sriInvoice ?? (await createDraft());
      if (!draft) return;
      const generated = await request<SriInvoice>(
        `/sri-invoices/${draft.id}/generate-xml`,
        { method: 'POST' },
      );
      onInvoiceChange(generated);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'No fue posible generar el XML de la factura.',
      );
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-6 backdrop-blur-sm">
      <Card className="max-h-[94vh] w-full max-w-6xl overflow-hidden">
        <div className="flex items-start justify-between border-b border-white/10 bg-gradient-to-br from-slate-950 via-teal-950 to-teal-700 p-6 text-white">
          <div className="flex items-start gap-4">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/10 text-teal-100 ring-1 ring-white/20">
              <FileCheck2 className="size-7" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-100">
                Facturación electrónica Ecuador
              </p>
              <h3 className="mt-2 text-2xl font-black">
                Asistente visual de emisión SRI
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-teal-50/85">
                Este flujo nace desde el cobro interno. Por ahora es una vista
                demostrativa: no firma, no envía y no autoriza comprobantes
                reales ante el SRI todavía.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="max-h-[calc(94vh-184px)] overflow-y-auto p-6">
          {actionError && (
            <p className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {actionError}
            </p>
          )}
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <Card className="border-slate-200 p-5 shadow-none">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">
                    Cobro origen
                  </p>
                  <Badge
                    className={cn(
                      isAuthorized
                        ? 'bg-emerald-50 text-emerald-700'
                        : sriInvoice
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {isAuthorized
                      ? 'Autorizado demo'
                      : sriInvoice
                        ? 'Borrador demo'
                        : 'Sin factura SRI'}
                  </Badge>
                </div>
                <div className="mt-5 space-y-3 text-sm">
                  <SriSummaryRow
                    label="Documento interno"
                    value={payment.invoiceNumber}
                  />
                  <SriSummaryRow label="Cliente" value={customerName} />
                  <SriSummaryRow
                    label="Identificación"
                    value={customerDocument}
                  />
                  <SriSummaryRow label="Correo" value={customerEmail} />
                  <div className="flex justify-between gap-4 border-t border-slate-100 pt-3">
                    <span className="text-slate-500">Total a facturar</span>
                    <span className="text-lg font-black text-slate-950">
                      {currency.format(payment.amount)}
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="border-teal-100 bg-teal-50/70 p-5 shadow-none">
                <p className="text-sm font-bold text-teal-900">
                  Lo que hará la versión real
                </p>
                <p className="mt-2 text-sm leading-6 text-teal-800">
                  El pago quedará como origen contable. Desde aquí se validarán
                  los datos tributarios, se generará el XML, se firmará con la
                  firma electrónica, se enviará al SRI y se guardarán XML
                  autorizado, clave de acceso y RIDE/PDF.
                </p>
              </Card>

              <Card className="border-slate-200 bg-slate-50 p-5 shadow-none">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Clave de acceso demo
                </p>
                  <p className="mt-3 break-all rounded-xl bg-white px-4 py-3 font-mono text-xs font-bold text-slate-700 ring-1 ring-slate-100">
                    {accessKey}
                  </p>
                  {sriInvoice?.authorizationNumber && (
                    <p className="mt-3 text-xs font-semibold text-emerald-700">
                      Autorización: {sriInvoice.authorizationNumber}
                    </p>
                  )}
                  {sriInvoice?.xmlPath && (
                    <p className="mt-3 break-all text-xs font-semibold text-teal-700">
                      XML: {sriInvoice.xmlPath}
                    </p>
                  )}
                  {sriInvoice?.sriMessage && (
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {sriInvoice.sriMessage}
                    </p>
                  )}
                </Card>
            </div>

            <div className="space-y-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const completed =
                  isAuthorized ||
                  (index === 0 && Boolean(sriInvoice)) ||
                  (index === 1 && hasXml);
                const active =
                  !isAuthorized &&
                  ((!sriInvoice && index === 0) ||
                    (sriInvoice && !hasXml && index === 1) ||
                    (hasXml && index === 2));
                return (
                  <div
                    key={step.label}
                    className={cn(
                      'flex items-center gap-4 rounded-2xl border p-4 transition',
                      completed
                        ? 'border-emerald-100 bg-emerald-50/70'
                        : active
                          ? 'border-teal-200 bg-teal-50'
                          : 'border-slate-200 bg-white',
                    )}
                  >
                    <div
                      className={cn(
                        'grid size-11 shrink-0 place-items-center rounded-xl',
                        completed
                          ? 'bg-emerald-100 text-emerald-700'
                          : active
                            ? 'bg-teal-100 text-teal-700'
                            : 'bg-slate-100 text-slate-400',
                      )}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900">{step.label}</p>
                      <p className="mt-0.5 truncate text-sm text-slate-500">
                        {step.description}
                      </p>
                    </div>
                    <Badge
                      className={cn(
                        completed
                          ? 'bg-emerald-100 text-emerald-700'
                          : active
                            ? 'bg-teal-100 text-teal-700'
                            : 'bg-slate-100 text-slate-500',
                      )}
                    >
                      {completed ? 'Listo' : active ? 'Siguiente' : 'Pendiente'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <p className="max-w-xl text-xs leading-5 text-slate-500">
            Demo visual local. La integración real necesitará RUC, firma
            electrónica, ambiente de pruebas/producción SRI, secuenciales y
            almacenamiento tributario.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={onReload}
              disabled={isWorking}
              className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
            >
              <RotateCcw className="size-4" />
              Recargar estado
            </Button>
            {!sriInvoice && (
              <Button
                onClick={() => void createDraft()}
                disabled={isWorking}
                className="border border-teal-200 bg-white text-teal-700 hover:bg-teal-50"
              >
                {isWorking ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <FileText className="size-4" />
                )}
                Crear borrador SRI
              </Button>
            )}
            {sriInvoice && !hasXml && (
              <Button
                onClick={() => void generateXml()}
                disabled={isWorking}
                className="border border-teal-200 bg-white text-teal-700 hover:bg-teal-50"
              >
                {isWorking ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <FileText className="size-4" />
                )}
                Generar XML
              </Button>
            )}
            <Button
              disabled={!isAuthorized}
              className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="size-4" />
              RIDE/PDF demo
            </Button>
            <Button
              onClick={() => void authorizeDemo()}
              disabled={isWorking || isAuthorized || !hasXml}
              className="bg-teal-600 text-white hover:bg-teal-700"
            >
              {isWorking ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              {isAuthorized ? 'Autorización lista' : 'Simular autorización SRI'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function SriSummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-bold text-slate-900">{value}</span>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <div className="grid size-9 place-items-center rounded-lg bg-slate-50 text-slate-400">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-slate-700">{value}</p>
      </div>
    </div>
  );
}

function PaymentMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: 'teal' | 'blue' | 'amber' | 'violet' | 'rose';
}) {
  const tones = {
    teal: 'bg-teal-50 text-teal-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
    rose: 'bg-rose-50 text-rose-700',
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
      </div>
    </Card>
  );
}
