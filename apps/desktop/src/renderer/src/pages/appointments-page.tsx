import {
  ClinicalConfirmDialog,
  ClinicalField,
  clinicalInputClass,
  ClinicalMetric,
  ClinicalModalHeader,
} from '@/components/clinical/clinical-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type {
  Appointment,
  AppointmentStatus,
  AppointmentType,
  AppointmentVeterinarian,
  PaginatedResponse,
  Pet,
} from '@/types/clinical';
import {
  addDays,
  addWeeks,
  differenceInMinutes,
  format,
  isSameDay,
  startOfWeek,
  subDays,
  subWeeks,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleX,
  Clock3,
  Dog,
  History,
  LoaderCircle,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Stethoscope,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';

type AgendaView = 'day' | 'week';

interface AppointmentsPageProps {
  initialPetId?: string;
  onOpenHistory?: (petId: string) => void;
  onCollectPayment?: (appointmentId: string) => void;
}

interface AppointmentFormState {
  petId: string;
  veterinarianId: string;
  type: AppointmentType;
  status: AppointmentStatus;
  date: string;
  time: string;
  duration: string;
  estimatedPrice: string;
  reason: string;
  notes: string;
}

const typeLabels: Record<AppointmentType, string> = {
  GENERAL_CONSULTATION: 'Consulta general',
  VACCINATION: 'Vacunación',
  FOLLOW_UP: 'Control',
  SURGERY: 'Cirugía',
  GROOMING: 'Baño y peluquería',
  EMERGENCY: 'Emergencia',
  DEWORMING: 'Desparasitación',
  OTHER: 'Otro',
};

const statusPresentation: Record<
  AppointmentStatus,
  { label: string; badge: string; border: string; dot: string }
> = {
  PENDING: {
    label: 'Pendiente',
    badge: 'bg-amber-50 text-amber-700',
    border: 'border-l-amber-400',
    dot: 'bg-amber-400',
  },
  CONFIRMED: {
    label: 'Confirmada',
    badge: 'bg-emerald-50 text-emerald-700',
    border: 'border-l-emerald-500',
    dot: 'bg-emerald-500',
  },
  COMPLETED: {
    label: 'Atendida',
    badge: 'bg-blue-50 text-blue-700',
    border: 'border-l-blue-500',
    dot: 'bg-blue-500',
  },
  CANCELLED: {
    label: 'Cancelada',
    badge: 'bg-rose-50 text-rose-700',
    border: 'border-l-rose-400',
    dot: 'bg-rose-400',
  },
  NO_SHOW: {
    label: 'No asistió',
    badge: 'bg-slate-100 text-slate-600',
    border: 'border-l-slate-400',
    dot: 'bg-slate-400',
  },
};

const appointmentTypes = Object.entries(typeLabels) as [
  AppointmentType,
  string,
][];
const appointmentStatuses = Object.entries(statusPresentation) as [
  AppointmentStatus,
  (typeof statusPresentation)[AppointmentStatus],
][];

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function defaultDateFor(selectedDate: Date): Date {
  const today = startOfLocalDay(new Date());
  return startOfLocalDay(selectedDate) < today ? today : selectedDate;
}

function nextAppointmentSlot(selectedDate: Date): Date {
  if (!isSameDay(selectedDate, new Date())) {
    const slot = startOfLocalDay(selectedDate);
    slot.setHours(9, 0, 0, 0);
    return slot;
  }
  const now = new Date();
  const roundedMinutes = Math.ceil((now.getMinutes() + 10) / 15) * 15;
  const next = new Date(now);
  next.setHours(now.getHours(), roundedMinutes, 0, 0);
  return next;
}

function newAppointmentForm(
  selectedDate: Date,
  petId = '',
): AppointmentFormState {
  const slot = nextAppointmentSlot(defaultDateFor(selectedDate));
  return {
    petId,
    veterinarianId: '',
    type: 'GENERAL_CONSULTATION',
    status: 'PENDING',
    date: format(slot, 'yyyy-MM-dd'),
    time: format(slot, 'HH:mm'),
    duration: '30',
    estimatedPrice: '',
    reason: '',
    notes: '',
  };
}

function formFromAppointment(
  appointment: Appointment,
): AppointmentFormState {
  const startsAt = new Date(appointment.startsAt);
  return {
    petId: appointment.petId,
    veterinarianId: appointment.veterinarianId ?? '',
    type: appointment.type,
    status: appointment.status,
    date: format(startsAt, 'yyyy-MM-dd'),
    time: format(startsAt, 'HH:mm'),
    duration: String(
      differenceInMinutes(new Date(appointment.endsAt), startsAt),
    ),
    estimatedPrice: appointment.estimatedPrice?.toString() ?? '',
    reason: appointment.reason ?? '',
    notes: appointment.notes ?? '',
  };
}

function formatOwner(pet: Pet | Appointment['pet']): string {
  return `${pet.owner.firstName} ${pet.owner.lastName}`;
}

export function AppointmentsPage({
  initialPetId,
  onOpenHistory,
  onCollectPayment,
}: AppointmentsPageProps) {
  const { request, user } = useAuth();
  const [view, setView] = useState<AgendaView>('day');
  const [selectedDate, setSelectedDate] = useState(startOfLocalDay(new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [veterinarians, setVeterinarians] = useState<
    AppointmentVeterinarian[]
  >([]);
  const [selectedPetId, setSelectedPetId] = useState(initialPetId ?? '');
  const [selectedVeterinarianId, setSelectedVeterinarianId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] =
    useState<Appointment | null>(null);
  const [deletingAppointment, setDeletingAppointment] =
    useState<Appointment | null>(null);
  const canManage =
    user?.permissions.includes('appointments.manage') ?? false;
  const canCollectPayment =
    user?.permissions.includes('payments.manage') ?? false;

  const visibleStart = useMemo(
    () =>
      view === 'day'
        ? startOfLocalDay(selectedDate)
        : startOfWeek(selectedDate, { weekStartsOn: 1 }),
    [selectedDate, view],
  );
  const visibleEnd = useMemo(
    () => addDays(visibleStart, view === 'day' ? 1 : 7),
    [view, visibleStart],
  );

  const loadCatalogs = useCallback(async () => {
    try {
      const [petData, veterinarianData] = await Promise.all([
        request<PaginatedResponse<Pet>>(
          '/pets?page=1&pageSize=100&status=ACTIVE',
        ),
        request<AppointmentVeterinarian[]>('/appointments/veterinarians'),
      ]);
      setPets(petData.items);
      setVeterinarians(veterinarianData);
      if (
        initialPetId &&
        petData.items.some((pet) => pet.id === initialPetId)
      ) {
        setSelectedPetId(initialPetId);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No fue posible cargar los datos de la agenda.',
      );
    }
  }, [initialPetId, request]);

  const loadAppointments = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        page: '1',
        pageSize: '100',
        dateFrom: visibleStart.toISOString(),
        dateTo: visibleEnd.toISOString(),
        ...(selectedPetId ? { petId: selectedPetId } : {}),
        ...(selectedVeterinarianId
          ? { veterinarianId: selectedVeterinarianId }
          : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      });
      const data = await request<PaginatedResponse<Appointment>>(
        `/appointments?${query.toString()}`,
      );
      setAppointments(data.items);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No fue posible cargar la agenda.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    request,
    search,
    selectedPetId,
    selectedVeterinarianId,
    statusFilter,
    visibleEnd,
    visibleStart,
  ]);

  useEffect(() => {
    void loadCatalogs();
  }, [loadCatalogs]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAppointments();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [loadAppointments]);

  const metrics = useMemo(
    () => ({
      total: appointments.length,
      pending: appointments.filter((item) => item.status === 'PENDING').length,
      confirmed: appointments.filter((item) => item.status === 'CONFIRMED')
        .length,
      completed: appointments.filter((item) => item.status === 'COMPLETED')
        .length,
    }),
    [appointments],
  );

  const openCreate = () => {
    setEditingAppointment(null);
    setIsFormOpen(true);
  };

  const openEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setIsFormOpen(true);
  };

  const handleSubmit = async (form: AppointmentFormState) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const startsAt = new Date(`${form.date}T${form.time}:00`);
      const endsAt = new Date(
        startsAt.getTime() + Number(form.duration) * 60_000,
      );
      await request(
        editingAppointment
          ? `/appointments/${editingAppointment.id}`
          : '/appointments',
        {
          method: editingAppointment ? 'PATCH' : 'POST',
          body: {
            petId: form.petId,
            veterinarianId: form.veterinarianId || null,
            type: form.type,
            status: form.status,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            estimatedPrice: form.estimatedPrice
              ? Number(form.estimatedPrice)
              : null,
            reason: form.reason.trim() || null,
            notes: form.notes.trim() || null,
          },
        },
      );
      setIsFormOpen(false);
      setEditingAppointment(null);
      setSelectedDate(startOfLocalDay(startsAt));
      await loadAppointments();
    } catch (submitError) {
      const message =
        submitError instanceof ApiError
          ? submitError.message
          : 'No fue posible guardar la cita.';
      setError(message);
      throw submitError;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (
    appointment: Appointment,
    status: AppointmentStatus,
  ) => {
    setIsSubmitting(true);
    try {
      await request(`/appointments/${appointment.id}/status`, {
        method: 'PATCH',
        body: { status },
      });
      await loadAppointments();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'No fue posible actualizar el estado.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingAppointment) return;
    setIsSubmitting(true);
    try {
      await request(`/appointments/${deletingAppointment.id}`, {
        method: 'DELETE',
      });
      setDeletingAppointment(null);
      await loadAppointments();
    } catch (deleteError) {
      setDeletingAppointment(null);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'No fue posible archivar la cita.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const moveDate = (direction: -1 | 1) => {
    setSelectedDate((current) =>
      view === 'day'
        ? direction === 1
          ? addDays(current, 1)
          : subDays(current, 1)
        : direction === 1
          ? addWeeks(current, 1)
          : subWeeks(current, 1),
    );
  };

  const dateTitle =
    view === 'day'
      ? format(selectedDate, "EEEE d 'de' MMMM", { locale: es })
      : `${format(visibleStart, "d 'de' MMM", { locale: es })} - ${format(
          addDays(visibleEnd, -1),
          "d 'de' MMM",
          { locale: es },
        )}`;

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">
            Organización clínica
          </p>
          <h1 className="mt-2 text-[28px] font-bold tracking-[-0.04em] text-slate-950">
            Agenda y citas
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Planifica la atención diaria y coordina los horarios del equipo.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={openCreate}
            className="h-10 bg-teal-600 px-4 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700"
          >
            <Plus className="size-4" />
            Nueva cita
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="font-bold text-rose-600"
          >
            Cerrar
          </button>
        </div>
      )}

      <section className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <ClinicalMetric
          icon={CalendarDays}
          color="bg-teal-50 text-teal-700"
          value={metrics.total}
          label={view === 'day' ? 'Citas del día' : 'Citas de la semana'}
        />
        <ClinicalMetric
          icon={CalendarClock}
          color="bg-amber-50 text-amber-700"
          value={metrics.pending}
          label="Pendientes"
        />
        <ClinicalMetric
          icon={CalendarCheck2}
          color="bg-emerald-50 text-emerald-700"
          value={metrics.confirmed}
          label="Confirmadas"
        />
        <ClinicalMetric
          icon={CheckCircle2}
          color="bg-blue-50 text-blue-700"
          value={metrics.completed}
          label="Atendidas"
        />
      </section>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setView('day')}
              className={cn(
                'h-8 rounded-lg px-4 text-xs font-bold transition',
                view === 'day'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-500',
              )}
            >
              Día
            </button>
            <button
              type="button"
              onClick={() => setView('week')}
              className={cn(
                'h-8 rounded-lg px-4 text-xs font-bold transition',
                view === 'week'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-500',
              )}
            >
              Semana
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => moveDate(-1)}
              className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(startOfLocalDay(new Date()))}
              className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => moveDate(1)}
              className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <p className="min-w-52 flex-1 text-center text-sm font-bold capitalize text-slate-800">
            {dateTitle}
          </p>

          <div className="relative w-52">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar cita..."
              className={`${clinicalInputClass} pl-9`}
            />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 md:grid-cols-3">
          <select
            value={selectedPetId}
            onChange={(event) => setSelectedPetId(event.target.value)}
            className={clinicalInputClass}
          >
            <option value="">Todos los pacientes</option>
            {pets.map((pet) => (
              <option key={pet.id} value={pet.id}>
                {pet.name} · {formatOwner(pet)}
              </option>
            ))}
          </select>
          <select
            value={selectedVeterinarianId}
            onChange={(event) =>
              setSelectedVeterinarianId(event.target.value)
            }
            className={clinicalInputClass}
          >
            <option value="">Todo el equipo veterinario</option>
            {veterinarians.map((veterinarian) => (
              <option key={veterinarian.id} value={veterinarian.id}>
                Dr. {veterinarian.firstName} {veterinarian.lastName}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={clinicalInputClass}
          >
            <option value="">Todos los estados</option>
            {appointmentStatuses.map(([status, presentation]) => (
              <option key={status} value={status}>
                {presentation.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="min-h-[430px] overflow-hidden">
        {isLoading ? (
          <div className="grid min-h-[430px] place-items-center text-slate-400">
            <LoaderCircle className="size-7 animate-spin" />
          </div>
        ) : view === 'day' ? (
          <DayAgenda
            appointments={appointments}
            canManage={canManage}
            submitting={isSubmitting}
            onEdit={openEdit}
            onDelete={setDeletingAppointment}
            onStatusChange={handleStatusChange}
            onOpenHistory={onOpenHistory}
            onCollectPayment={onCollectPayment}
            canCollectPayment={canCollectPayment}
            onCreate={canManage ? openCreate : undefined}
          />
        ) : (
          <WeekAgenda
            start={visibleStart}
            appointments={appointments}
            canManage={canManage}
            submitting={isSubmitting}
            onSelectDay={(date) => {
              setSelectedDate(date);
              setView('day');
            }}
            onEdit={openEdit}
            onDelete={setDeletingAppointment}
            onStatusChange={handleStatusChange}
            onOpenHistory={onOpenHistory}
            onCollectPayment={onCollectPayment}
            canCollectPayment={canCollectPayment}
          />
        )}
      </Card>

      {isFormOpen && (
        <AppointmentFormModal
          key={editingAppointment?.id ?? `new-${selectedDate.toISOString()}`}
          initialForm={
            editingAppointment
              ? formFromAppointment(editingAppointment)
              : newAppointmentForm(selectedDate, selectedPetId)
          }
          pets={pets}
          veterinarians={veterinarians}
          editing={Boolean(editingAppointment)}
          submitting={isSubmitting}
          onClose={() => {
            setIsFormOpen(false);
            setEditingAppointment(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {deletingAppointment && (
        <ClinicalConfirmDialog
          title="Archivar cita"
          message={`La cita de ${deletingAppointment.pet.name} del ${format(
            new Date(deletingAppointment.startsAt),
            "d 'de' MMMM 'a las' HH:mm",
            { locale: es },
          )} dejará de aparecer en la agenda.`}
          disabled={isSubmitting}
          onCancel={() => setDeletingAppointment(null)}
          onConfirm={() => void handleDelete()}
        />
      )}
    </>
  );
}

interface AgendaActions {
  canManage: boolean;
  submitting: boolean;
  onEdit: (appointment: Appointment) => void;
  onDelete: (appointment: Appointment) => void;
  onStatusChange: (
    appointment: Appointment,
    status: AppointmentStatus,
  ) => void;
  onOpenHistory?: (petId: string) => void;
  onCollectPayment?: (appointmentId: string) => void;
  canCollectPayment: boolean;
}

function DayAgenda({
  appointments,
  onCreate,
  ...actions
}: {
  appointments: Appointment[];
  onCreate?: () => void;
} & AgendaActions) {
  if (appointments.length === 0) {
    return <EmptyAgenda onCreate={onCreate} />;
  }

  return (
    <div className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Línea de tiempo
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {appointments.length} atenciones programadas
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="size-2 rounded-full bg-emerald-500" />
          Horario local
        </div>
      </div>
      <div className="relative space-y-3 before:absolute before:bottom-4 before:left-[76px] before:top-4 before:w-px before:bg-slate-200">
        {appointments.map((appointment) => (
          <div
            key={appointment.id}
            className="relative grid grid-cols-[64px_1fr] gap-6"
          >
            <div className="pt-4 text-right">
              <p className="text-sm font-bold text-slate-800">
                {format(new Date(appointment.startsAt), 'HH:mm')}
              </p>
              <p className="text-[10px] text-slate-400">
                {differenceInMinutes(
                  new Date(appointment.endsAt),
                  new Date(appointment.startsAt),
                )}{' '}
                min
              </p>
            </div>
            <span
              className={cn(
                'absolute left-[72px] top-5 z-10 size-2.5 rounded-full ring-4 ring-white',
                statusPresentation[appointment.status].dot,
              )}
            />
            <AppointmentCard appointment={appointment} {...actions} />
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekAgenda({
  start,
  appointments,
  onSelectDay,
  ...actions
}: {
  start: Date;
  appointments: Appointment[];
  onSelectDay: (date: Date) => void;
} & AgendaActions) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[900px] grid-cols-7 divide-x divide-slate-100">
        {days.map((day) => {
          const dayItems = appointments.filter((appointment) =>
            isSameDay(new Date(appointment.startsAt), day),
          );
          const today = isSameDay(day, new Date());
          return (
            <section key={day.toISOString()} className="min-h-[450px]">
              <button
                type="button"
                onClick={() => onSelectDay(day)}
                className={cn(
                  'flex w-full items-center justify-between border-b border-slate-100 px-3 py-4 text-left',
                  today ? 'bg-teal-50/70' : 'bg-slate-50/60',
                )}
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {format(day, 'EEEE', { locale: es })}
                  </p>
                  <p
                    className={cn(
                      'mt-1 text-xl font-bold',
                      today ? 'text-teal-700' : 'text-slate-800',
                    )}
                  >
                    {format(day, 'd')}
                  </p>
                </div>
                <Badge
                  className={
                    today
                      ? 'bg-teal-600 text-white'
                      : 'bg-white text-slate-500'
                  }
                >
                  {dayItems.length}
                </Badge>
              </button>
              <div className="space-y-2 p-2">
                {dayItems.length === 0 ? (
                  <p className="py-8 text-center text-[11px] text-slate-300">
                    Sin citas
                  </p>
                ) : (
                  dayItems.map((appointment) => (
                    <WeekAppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      {...actions}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function AppointmentCard({
  appointment,
  canManage,
  canCollectPayment,
  submitting,
  onEdit,
  onDelete,
  onStatusChange,
  onOpenHistory,
  onCollectPayment,
}: { appointment: Appointment } & AgendaActions) {
  const presentation = statusPresentation[appointment.status];
  const canBillAppointment =
    (appointment.status === 'CONFIRMED' ||
      appointment.status === 'COMPLETED') &&
    appointment._count.payments === 0;
  return (
    <article
      className={cn(
        'rounded-2xl border border-l-4 border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-md',
        presentation.border,
      )}
    >
      <div className="flex items-start gap-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700">
          <Dog className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-slate-900">
              {appointment.pet.name}
            </h3>
            <Badge className={presentation.badge}>{presentation.label}</Badge>
            <span className="text-xs font-semibold text-teal-700">
              {typeLabels[appointment.type]}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {formatOwner(appointment.pet)} · {appointment.pet.owner.phone}
          </p>
          {appointment.reason && (
            <p className="mt-2 text-sm text-slate-700">
              {appointment.reason}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Clock3 className="size-3.5 text-slate-400" />
              {format(new Date(appointment.startsAt), 'HH:mm')} -{' '}
              {format(new Date(appointment.endsAt), 'HH:mm')}
            </span>
            <span className="flex items-center gap-1.5">
              <Stethoscope className="size-3.5 text-slate-400" />
              {appointment.veterinarian
                ? `Dr. ${appointment.veterinarian.firstName} ${appointment.veterinarian.lastName}`
                : 'Profesional por asignar'}
            </span>
            {appointment.estimatedPrice !== null && (
              <span className="rounded-full bg-emerald-50 px-2 py-1 font-bold text-emerald-700">
                ${Number(appointment.estimatedPrice).toFixed(2)}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canManage && (
            <select
              value={appointment.status}
              disabled={submitting}
              onChange={(event) =>
                onStatusChange(
                  appointment,
                  event.target.value as AppointmentStatus,
                )
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 outline-none focus:border-teal-500"
            >
              {appointmentStatuses.map(([status, item]) => (
                <option key={status} value={status}>
                  {item.label}
                </option>
              ))}
            </select>
          )}
          {appointment._count.payments > 0 ? (
            <span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
              Cobro generado
            </span>
          ) : (
            canCollectPayment &&
            canBillAppointment &&
            onCollectPayment && (
              <button
                type="button"
                onClick={() => onCollectPayment(appointment.id)}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-teal-600 px-3 text-xs font-bold text-white shadow-sm shadow-teal-600/20 hover:bg-teal-700"
                title="Generar cobro desde esta cita"
              >
                <ReceiptText className="size-4" />
                Cobrar
              </button>
            )
          )}
          {onOpenHistory && (
            <button
              type="button"
              onClick={() => onOpenHistory(appointment.petId)}
              className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-violet-50 hover:text-violet-700"
              title="Abrir historial"
            >
              <History className="size-4" />
            </button>
          )}
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => onEdit(appointment)}
                className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-700"
                title="Editar cita"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(appointment)}
                className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                title="Archivar cita"
              >
                <Trash2 className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function WeekAppointmentCard({
  appointment,
  canManage,
  submitting,
  onEdit,
  onStatusChange,
}: { appointment: Appointment } & AgendaActions) {
  const presentation = statusPresentation[appointment.status];
  return (
    <article
      className={cn(
        'rounded-xl border border-l-[3px] border-slate-200 bg-white p-3 shadow-sm',
        presentation.border,
      )}
    >
      <button
        type="button"
        disabled={!canManage}
        onClick={() => canManage && onEdit(appointment)}
        className="w-full text-left disabled:cursor-default"
      >
        <p className="text-[11px] font-bold text-teal-700">
          {format(new Date(appointment.startsAt), 'HH:mm')} ·{' '}
          {differenceInMinutes(
            new Date(appointment.endsAt),
            new Date(appointment.startsAt),
          )}{' '}
          min
        </p>
        <p className="mt-1 truncate text-sm font-bold text-slate-800">
          {appointment.pet.name}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-slate-400">
          {typeLabels[appointment.type]}
        </p>
      </button>
      {canManage && (
        <select
          value={appointment.status}
          disabled={submitting}
          onChange={(event) =>
            onStatusChange(
              appointment,
              event.target.value as AppointmentStatus,
            )
          }
          className={cn(
            'mt-2 h-7 w-full rounded-lg border-0 px-2 text-[10px] font-bold outline-none',
            presentation.badge,
          )}
        >
          {appointmentStatuses.map(([status, item]) => (
            <option key={status} value={status}>
              {item.label}
            </option>
          ))}
        </select>
      )}
    </article>
  );
}

function EmptyAgenda({ onCreate }: { onCreate?: () => void }) {
  return (
    <div className="grid min-h-[430px] place-items-center p-8 text-center">
      <div>
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-teal-50 text-teal-600">
          <CalendarCheck2 className="size-8" />
        </div>
        <h2 className="mt-5 text-lg font-bold text-slate-900">
          Agenda disponible
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
          No hay citas programadas para este periodo con los filtros actuales.
        </p>
        {onCreate && (
          <Button
            onClick={onCreate}
            className="mt-5 bg-teal-600 text-white hover:bg-teal-700"
          >
            <Plus className="size-4" />
            Programar cita
          </Button>
        )}
      </div>
    </div>
  );
}

function AppointmentFormModal({
  initialForm,
  pets,
  veterinarians,
  editing,
  submitting,
  onClose,
  onSubmit,
}: {
  initialForm: AppointmentFormState;
  pets: Pet[];
  veterinarians: AppointmentVeterinarian[];
  editing: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (form: AppointmentFormState) => Promise<void>;
}) {
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const selectedPet = pets.find((pet) => pet.id === form.petId);

  const updateField = <K extends keyof AppointmentFormState>(
    field: K,
    value: AppointmentFormState[K],
  ) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!form.petId || !form.date || !form.time) {
      setFormError('Selecciona paciente, fecha y hora.');
      return;
    }
    if (form.estimatedPrice && Number(form.estimatedPrice) < 0) {
      setFormError('El valor estimado no puede ser negativo.');
      return;
    }
    try {
      await onSubmit(form);
    } catch (submitError) {
      setFormError(
        submitError instanceof Error
          ? submitError.message
          : 'No fue posible guardar la cita.',
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-6 backdrop-blur-sm">
      <Card className="max-h-[92vh] w-full max-w-3xl overflow-y-auto p-6">
        <ClinicalModalHeader
          eyebrow={editing ? 'Editar programación' : 'Nueva programación'}
          title={editing ? 'Actualizar cita' : 'Programar una cita'}
          onClose={onClose}
        />
        <form onSubmit={(event) => void submit(event)} className="mt-6">
          {formError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <ClinicalField label="Paciente">
              <select
                required
                value={form.petId}
                onChange={(event) =>
                  updateField('petId', event.target.value)
                }
                className={clinicalInputClass}
              >
                <option value="">Seleccionar mascota</option>
                {pets.map((pet) => (
                  <option key={pet.id} value={pet.id}>
                    {pet.name} · {formatOwner(pet)}
                  </option>
                ))}
              </select>
            </ClinicalField>
            <ClinicalField label="Veterinario" optional>
              <select
                value={form.veterinarianId}
                onChange={(event) =>
                  updateField('veterinarianId', event.target.value)
                }
                className={clinicalInputClass}
              >
                <option value="">Asignar más tarde</option>
                {veterinarians.map((veterinarian) => (
                  <option key={veterinarian.id} value={veterinarian.id}>
                    Dr. {veterinarian.firstName} {veterinarian.lastName}
                  </option>
                ))}
              </select>
            </ClinicalField>
          </div>

          {selectedPet && (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3">
              <div className="grid size-9 place-items-center rounded-lg bg-white text-teal-700">
                <UsersRound className="size-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700">
                  Responsable: {formatOwner(selectedPet)}
                </p>
                <p className="text-[11px] text-slate-500">
                  {selectedPet.owner.phone}
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-4">
            <ClinicalField label="Servicio">
              <select
                value={form.type}
                onChange={(event) =>
                  updateField(
                    'type',
                    event.target.value as AppointmentType,
                  )
                }
                className={clinicalInputClass}
              >
                {appointmentTypes.map(([type, label]) => (
                  <option key={type} value={type}>
                    {label}
                  </option>
                ))}
              </select>
            </ClinicalField>
            <ClinicalField label="Estado">
              <select
                value={form.status}
                onChange={(event) =>
                  updateField(
                    'status',
                    event.target.value as AppointmentStatus,
                  )
                }
                className={clinicalInputClass}
              >
                {appointmentStatuses.map(([status, presentation]) => (
                  <option key={status} value={status}>
                    {presentation.label}
                  </option>
                ))}
              </select>
            </ClinicalField>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-4">
            <ClinicalField label="Fecha">
              <input
                required
                type="date"
                value={form.date}
                onChange={(event) => updateField('date', event.target.value)}
                className={clinicalInputClass}
              />
            </ClinicalField>
            <ClinicalField label="Hora de inicio">
              <input
                required
                type="time"
                step="900"
                value={form.time}
                onChange={(event) => updateField('time', event.target.value)}
                className={clinicalInputClass}
              />
            </ClinicalField>
            <ClinicalField label="Duración">
              <select
                value={form.duration}
                onChange={(event) =>
                  updateField('duration', event.target.value)
                }
                className={clinicalInputClass}
              >
                {[15, 30, 45, 60, 90, 120].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes < 60
                      ? `${minutes} minutos`
                      : `${minutes / 60} ${minutes === 60 ? 'hora' : 'horas'}`}
                  </option>
                ))}
              </select>
            </ClinicalField>
            <ClinicalField label="Valor estimado" optional>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.estimatedPrice}
                onChange={(event) =>
                  updateField('estimatedPrice', event.target.value)
                }
                placeholder="Ej. 25.00"
                className={clinicalInputClass}
              />
            </ClinicalField>
          </div>

          <div className="mt-4">
            <ClinicalField label="Motivo de la cita" optional>
              <input
                value={form.reason}
                maxLength={255}
                onChange={(event) =>
                  updateField('reason', event.target.value)
                }
                placeholder="Ej. Control dermatológico"
                className={clinicalInputClass}
              />
            </ClinicalField>
          </div>

          <div className="mt-4">
            <ClinicalField label="Notas internas" optional>
              <textarea
                value={form.notes}
                maxLength={4000}
                onChange={(event) =>
                  updateField('notes', event.target.value)
                }
                placeholder="Indicaciones para recepción o el equipo clínico..."
                className={`${clinicalInputClass} min-h-24 resize-none py-3`}
              />
            </ClinicalField>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
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
              className="bg-teal-600 px-5 text-white hover:bg-teal-700"
            >
              {submitting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : editing ? (
                <CalendarCheck2 className="size-4" />
              ) : (
                <Plus className="size-4" />
              )}
              {editing ? 'Guardar cambios' : 'Programar cita'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
