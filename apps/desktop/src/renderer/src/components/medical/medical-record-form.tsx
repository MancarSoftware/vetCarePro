import {
  ClinicalField,
  clinicalInputClass,
  ClinicalModalHeader,
} from '@/components/clinical/clinical-ui';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type {
  MedicalRecord,
  MedicalRecordType,
  Pet,
} from '@/types/clinical';
import { LoaderCircle, Plus, Trash2 } from 'lucide-react';
import type { FormEvent } from 'react';

export interface MedicationForm {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface MedicalRecordFormState {
  petId: string;
  type: MedicalRecordType;
  occurredAt: string;
  complaint: string;
  symptoms: string;
  diagnosis: string;
  treatmentPlan: string;
  medications: MedicationForm[];
  notes: string;
  nextReviewAt: string;
}

function toLocalDateTime(value: Date | string): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function emptyMedicalRecordForm(
  petId = '',
): MedicalRecordFormState {
  return {
    petId,
    type: 'CONSULTATION',
    occurredAt: toLocalDateTime(new Date()),
    complaint: '',
    symptoms: '',
    diagnosis: '',
    treatmentPlan: '',
    medications: [],
    notes: '',
    nextReviewAt: '',
  };
}

export function medicalRecordToForm(
  record: MedicalRecord,
): MedicalRecordFormState {
  return {
    petId: record.petId,
    type: record.type,
    occurredAt: toLocalDateTime(record.occurredAt),
    complaint: record.complaint ?? '',
    symptoms: record.symptoms ?? '',
    diagnosis: record.diagnosis ?? '',
    treatmentPlan: record.treatmentPlan ?? '',
    medications:
      record.medications?.map((medication) => ({
        name: medication.name,
        dosage: medication.dosage ?? '',
        frequency: medication.frequency ?? '',
        duration: medication.duration ?? '',
      })) ?? [],
    notes: record.notes ?? '',
    nextReviewAt: record.nextReviewAt
      ? toLocalDateTime(record.nextReviewAt)
      : '',
  };
}

const typeOptions: Array<{ value: MedicalRecordType; label: string }> = [
  { value: 'CONSULTATION', label: 'Consulta' },
  { value: 'FOLLOW_UP', label: 'Control / seguimiento' },
  { value: 'TREATMENT', label: 'Tratamiento' },
  { value: 'VACCINATION', label: 'Vacunación' },
  { value: 'SURGERY', label: 'Cirugía' },
  { value: 'LAB_RESULT', label: 'Resultado de laboratorio' },
  { value: 'OTHER', label: 'Otro evento clínico' },
];

export function MedicalRecordFormModal({
  form,
  pets,
  editing,
  submitting,
  onChange,
  onClose,
  onSubmit,
}: {
  form: MedicalRecordFormState;
  pets: Pet[];
  editing: boolean;
  submitting: boolean;
  onChange: (form: MedicalRecordFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const setField = <K extends keyof MedicalRecordFormState>(
    field: K,
    value: MedicalRecordFormState[K],
  ) => onChange({ ...form, [field]: value });

  const addMedication = () =>
    setField('medications', [
      ...form.medications,
      { name: '', dosage: '', frequency: '', duration: '' },
    ]);

  const updateMedication = (
    index: number,
    field: keyof MedicationForm,
    value: string,
  ) => {
    setField(
      'medications',
      form.medications.map((medication, medicationIndex) =>
        medicationIndex === index
          ? { ...medication, [field]: value }
          : medication,
      ),
    );
  };

  const removeMedication = (index: number) =>
    setField(
      'medications',
      form.medications.filter((_, medicationIndex) => medicationIndex !== index),
    );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-6 backdrop-blur-sm">
      <Card className="max-h-[94vh] w-full max-w-4xl overflow-y-auto p-6">
        <ClinicalModalHeader
          eyebrow={editing ? 'Actualizar evolución' : 'Nueva atención'}
          title={editing ? 'Editar entrada clínica' : 'Registrar atención clínica'}
          onClose={onClose}
        />

        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <ClinicalField label="Paciente">
              <select
                required
                disabled={editing}
                value={form.petId}
                onChange={(event) => setField('petId', event.target.value)}
                className={clinicalInputClass}
              >
                <option value="">Selecciona una mascota</option>
                {pets.map((pet) => (
                  <option key={pet.id} value={pet.id}>
                    {pet.name} · {pet.owner.firstName} {pet.owner.lastName}
                  </option>
                ))}
              </select>
            </ClinicalField>
            <ClinicalField label="Tipo de entrada">
              <select
                value={form.type}
                onChange={(event) =>
                  setField(
                    'type',
                    event.target.value as MedicalRecordType,
                  )
                }
                className={clinicalInputClass}
              >
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </ClinicalField>
            <ClinicalField label="Fecha de atención">
              <input
                required
                type="datetime-local"
                max={toLocalDateTime(new Date())}
                value={form.occurredAt}
                onChange={(event) =>
                  setField('occurredAt', event.target.value)
                }
                className={clinicalInputClass}
              />
            </ClinicalField>
          </div>

          <ClinicalField label="Motivo de consulta o título">
            <textarea
              required
              minLength={3}
              maxLength={4000}
              rows={2}
              value={form.complaint}
              onChange={(event) => setField('complaint', event.target.value)}
              placeholder="Describe brevemente por qué se atendió al paciente."
              className={`${clinicalInputClass} h-auto resize-none py-3`}
            />
          </ClinicalField>

          <div className="grid grid-cols-2 gap-3">
            <ClinicalField label="Síntomas y hallazgos" optional>
              <textarea
                maxLength={4000}
                rows={4}
                value={form.symptoms}
                onChange={(event) => setField('symptoms', event.target.value)}
                placeholder="Signos observados, examen físico, evolución..."
                className={`${clinicalInputClass} h-auto resize-none py-3`}
              />
            </ClinicalField>
            <ClinicalField label="Diagnóstico" optional>
              <textarea
                maxLength={4000}
                rows={4}
                value={form.diagnosis}
                onChange={(event) => setField('diagnosis', event.target.value)}
                placeholder="Diagnóstico presuntivo o definitivo."
                className={`${clinicalInputClass} h-auto resize-none py-3`}
              />
            </ClinicalField>
          </div>

          <ClinicalField label="Plan de tratamiento" optional>
            <textarea
              maxLength={6000}
              rows={3}
              value={form.treatmentPlan}
              onChange={(event) =>
                setField('treatmentPlan', event.target.value)
              }
              placeholder="Indicaciones, cuidados, procedimientos y seguimiento."
              className={`${clinicalInputClass} h-auto resize-none py-3`}
            />
          </ClinicalField>

          <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Medicamentos
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Registra dosis, frecuencia y duración de cada indicación.
                </p>
              </div>
              <Button
                onClick={addMedication}
                className="border border-teal-200 bg-white text-teal-700 hover:bg-teal-50"
              >
                <Plus className="size-4" />
                Añadir medicamento
              </Button>
            </div>

            {form.medications.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-5 text-center text-xs text-slate-400">
                No se han indicado medicamentos.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {form.medications.map((medication, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1.2fr_1fr_1fr_1fr_auto] gap-2 rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <input
                      required
                      maxLength={160}
                      value={medication.name}
                      onChange={(event) =>
                        updateMedication(index, 'name', event.target.value)
                      }
                      placeholder="Medicamento"
                      className={clinicalInputClass}
                    />
                    <input
                      maxLength={120}
                      value={medication.dosage}
                      onChange={(event) =>
                        updateMedication(index, 'dosage', event.target.value)
                      }
                      placeholder="Dosis"
                      className={clinicalInputClass}
                    />
                    <input
                      maxLength={120}
                      value={medication.frequency}
                      onChange={(event) =>
                        updateMedication(index, 'frequency', event.target.value)
                      }
                      placeholder="Frecuencia"
                      className={clinicalInputClass}
                    />
                    <input
                      maxLength={120}
                      value={medication.duration}
                      onChange={(event) =>
                        updateMedication(index, 'duration', event.target.value)
                      }
                      placeholder="Duración"
                      className={clinicalInputClass}
                    />
                    <button
                      type="button"
                      onClick={() => removeMedication(index)}
                      title="Quitar medicamento"
                      className="grid size-11 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid grid-cols-2 gap-3">
            <ClinicalField label="Próxima revisión" optional>
              <input
                type="datetime-local"
                min={form.occurredAt}
                value={form.nextReviewAt}
                onChange={(event) =>
                  setField('nextReviewAt', event.target.value)
                }
                className={clinicalInputClass}
              />
            </ClinicalField>
            <ClinicalField label="Observaciones adicionales" optional>
              <textarea
                maxLength={6000}
                rows={2}
                value={form.notes}
                onChange={(event) => setField('notes', event.target.value)}
                className={`${clinicalInputClass} h-auto resize-none py-3`}
              />
            </ClinicalField>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button
              onClick={onClose}
              className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-teal-600 px-4 text-white hover:bg-teal-700"
            >
              {submitting && <LoaderCircle className="size-4 animate-spin" />}
              {editing ? 'Guardar cambios' : 'Guardar en historial'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
