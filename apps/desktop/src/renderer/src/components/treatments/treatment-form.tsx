import {
  ClinicalField,
  clinicalInputClass,
  ClinicalModalHeader,
} from '@/components/clinical/clinical-ui';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type {
  Medication,
  Pet,
  Treatment,
  TreatmentStatus,
} from '@/types/clinical';
import { addDays, format } from 'date-fns';
import { CalendarDays, LoaderCircle, Pill, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

export interface TreatmentFormState {
  petId: string;
  medicalRecordId: string;
  diagnosis: string;
  instructions: string;
  medications: Medication[];
  dosage: string;
  frequency: string;
  durationDays: string;
  startDate: string;
  status: TreatmentStatus;
  notes: string;
}

export function emptyTreatmentForm(
  petId = '',
  medicalRecordId = '',
): TreatmentFormState {
  return {
    petId,
    medicalRecordId,
    diagnosis: '',
    instructions: '',
    medications: [],
    dosage: '',
    frequency: '',
    durationDays: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'ACTIVE',
    notes: '',
  };
}

export function treatmentToForm(treatment: Treatment): TreatmentFormState {
  return {
    petId: treatment.petId,
    medicalRecordId: treatment.medicalRecordId ?? '',
    diagnosis: treatment.diagnosis,
    instructions: treatment.instructions,
    medications: treatment.medications ?? [],
    dosage: treatment.dosage ?? '',
    frequency: treatment.frequency ?? '',
    durationDays: treatment.durationDays?.toString() ?? '',
    startDate: treatment.startDate.slice(0, 10),
    status: treatment.status,
    notes: treatment.notes ?? '',
  };
}

export function TreatmentFormModal({
  initialForm,
  pets,
  editing,
  submitting,
  onClose,
  onSubmit,
}: {
  initialForm: TreatmentFormState;
  pets: Pet[];
  editing: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (form: TreatmentFormState) => Promise<void>;
}) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);
  const estimatedEnd = useMemo(() => {
    const days = Number(form.durationDays);
    if (!form.startDate || !Number.isInteger(days) || days < 1) return null;
    return addDays(new Date(`${form.startDate}T12:00:00`), days - 1);
  }, [form.durationDays, form.startDate]);

  const update = <K extends keyof TreatmentFormState>(
    key: K,
    value: TreatmentFormState[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const updateMedication = (
    index: number,
    key: keyof Medication,
    value: string,
  ) => {
    update(
      'medications',
      form.medications.map((medication, medicationIndex) =>
        medicationIndex === index
          ? { ...medication, [key]: value }
          : medication,
      ),
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!form.petId || !form.diagnosis.trim() || !form.instructions.trim()) {
      setError('Selecciona el paciente y completa diagnóstico e indicaciones.');
      return;
    }
    if (
      form.durationDays &&
      (!Number.isInteger(Number(form.durationDays)) ||
        Number(form.durationDays) < 1)
    ) {
      setError('La duración debe ser un número entero mayor que cero.');
      return;
    }
    if (form.medications.some((medication) => medication.name.trim().length < 2)) {
      setError('Completa el nombre de cada medicamento agregado.');
      return;
    }
    try {
      await onSubmit(form);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No fue posible guardar el tratamiento.',
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-6 backdrop-blur-sm">
      <Card className="max-h-[94vh] w-full max-w-4xl overflow-y-auto p-6">
        <ClinicalModalHeader
          eyebrow={editing ? 'Editar plan clínico' : 'Nuevo plan clínico'}
          title={editing ? 'Actualizar tratamiento' : 'Registrar tratamiento'}
          onClose={onClose}
        />
        <form onSubmit={(event) => void submit(event)} className="mt-6">
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <ClinicalField label="Paciente">
              <select
                required
                disabled={editing}
                value={form.petId}
                onChange={(event) => update('petId', event.target.value)}
                className={clinicalInputClass}
              >
                <option value="">Seleccionar mascota</option>
                {pets.map((pet) => (
                  <option key={pet.id} value={pet.id}>
                    {pet.name} · {pet.owner.firstName} {pet.owner.lastName}
                  </option>
                ))}
              </select>
            </ClinicalField>
            <ClinicalField label="Estado">
              <select
                value={form.status}
                onChange={(event) =>
                  update('status', event.target.value as TreatmentStatus)
                }
                className={clinicalInputClass}
              >
                <option value="ACTIVE">Activo</option>
                <option value="FOLLOW_UP">En control</option>
                <option value="COMPLETED">Finalizado</option>
                <option value="SUSPENDED">Suspendido</option>
              </select>
            </ClinicalField>
          </div>

          {form.medicalRecordId && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-xs font-semibold text-violet-700">
              <CalendarDays className="size-4" />
              Vinculado a una atención existente del historial clínico.
            </div>
          )}

          <div className="mt-4">
            <ClinicalField label="Diagnóstico">
              <textarea
                required
                value={form.diagnosis}
                maxLength={4000}
                onChange={(event) => update('diagnosis', event.target.value)}
                placeholder="Diagnóstico que origina el tratamiento..."
                className={`${clinicalInputClass} min-h-24 resize-none py-3`}
              />
            </ClinicalField>
          </div>

          <div className="mt-4">
            <ClinicalField label="Tratamiento e indicaciones">
              <textarea
                required
                value={form.instructions}
                maxLength={6000}
                onChange={(event) => update('instructions', event.target.value)}
                placeholder="Cuidados, procedimiento, reposo, alimentación y controles..."
                className={`${clinicalInputClass} min-h-28 resize-none py-3`}
              />
            </ClinicalField>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-800">Medicamentos</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Registra dosis, frecuencia y duración por medicamento.
                </p>
              </div>
              <Button
                onClick={() =>
                  update('medications', [
                    ...form.medications,
                    {
                      name: '',
                      dosage: '',
                      frequency: '',
                      duration: '',
                    },
                  ])
                }
                className="border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
              >
                <Plus className="size-4" />
                Agregar
              </Button>
            </div>
            {form.medications.length === 0 ? (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-5 text-xs text-slate-400">
                <Pill className="size-5" />
                No se han agregado medicamentos a este plan.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {form.medications.map((medication, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1.25fr_1fr_1fr_1fr_36px] gap-2"
                  >
                    <input
                      value={medication.name}
                      onChange={(event) =>
                        updateMedication(index, 'name', event.target.value)
                      }
                      placeholder="Medicamento"
                      className={clinicalInputClass}
                    />
                    <input
                      value={medication.dosage ?? ''}
                      onChange={(event) =>
                        updateMedication(index, 'dosage', event.target.value)
                      }
                      placeholder="Dosis"
                      className={clinicalInputClass}
                    />
                    <input
                      value={medication.frequency ?? ''}
                      onChange={(event) =>
                        updateMedication(index, 'frequency', event.target.value)
                      }
                      placeholder="Frecuencia"
                      className={clinicalInputClass}
                    />
                    <input
                      value={medication.duration ?? ''}
                      onChange={(event) =>
                        updateMedication(index, 'duration', event.target.value)
                      }
                      placeholder="Duración"
                      className={clinicalInputClass}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        update(
                          'medications',
                          form.medications.filter(
                            (_, medicationIndex) => medicationIndex !== index,
                          ),
                        )
                      }
                      className="grid size-9 place-items-center self-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4">
            <ClinicalField label="Fecha de inicio">
              <input
                required
                type="date"
                value={form.startDate}
                onChange={(event) => update('startDate', event.target.value)}
                className={clinicalInputClass}
              />
            </ClinicalField>
            <ClinicalField label="Duración en días" optional>
              <input
                type="number"
                min="1"
                max="3650"
                value={form.durationDays}
                onChange={(event) => update('durationDays', event.target.value)}
                placeholder="Sin fecha límite"
                className={clinicalInputClass}
              />
            </ClinicalField>
            <ClinicalField label="Finalización estimada" optional>
              <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600">
                {estimatedEnd
                  ? format(estimatedEnd, 'dd/MM/yyyy')
                  : 'Tratamiento continuo'}
              </div>
            </ClinicalField>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <ClinicalField label="Dosis general" optional>
              <input
                value={form.dosage}
                maxLength={255}
                onChange={(event) => update('dosage', event.target.value)}
                placeholder="Ej. Según peso del paciente"
                className={clinicalInputClass}
              />
            </ClinicalField>
            <ClinicalField label="Frecuencia general" optional>
              <input
                value={form.frequency}
                maxLength={255}
                onChange={(event) => update('frequency', event.target.value)}
                placeholder="Ej. Cada 12 horas"
                className={clinicalInputClass}
              />
            </ClinicalField>
          </div>

          <div className="mt-4">
            <ClinicalField label="Observaciones" optional>
              <textarea
                value={form.notes}
                maxLength={6000}
                onChange={(event) => update('notes', event.target.value)}
                placeholder="Precauciones, contraindicaciones o notas internas..."
                className={`${clinicalInputClass} min-h-20 resize-none py-3`}
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
                <CalendarDays className="size-4" />
              ) : (
                <Plus className="size-4" />
              )}
              {editing ? 'Guardar cambios' : 'Crear tratamiento'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
