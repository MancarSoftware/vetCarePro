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
import type {
  ClinicalMediaFile,
  MediaCategory,
  MedicalRecord,
  PaginatedResponse,
  Pet,
} from '@/types/clinical';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
  Download,
  Eye,
  FileImage,
  FileScan,
  FileText,
  FolderOpen,
  HardDrive,
  ImageOff,
  Images,
  LoaderCircle,
  Paperclip,
  Plus,
  ScanLine,
  Search,
  Stethoscope,
  Tag,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';

interface MediaPageProps {
  initialPetId?: string;
  initialMedicalRecordId?: string;
  initialTreatmentId?: string;
}

interface CategoryPresentation {
  label: string;
  icon: LucideIcon;
  className: string;
}

const categoryPresentation: Record<
  MediaCategory,
  CategoryPresentation
> = {
  PET_PROFILE: {
    label: 'Perfil',
    icon: FileImage,
    className: 'bg-cyan-50 text-cyan-700',
  },
  WOUND: {
    label: 'Herida',
    icon: ScanLine,
    className: 'bg-rose-50 text-rose-700',
  },
  RADIOGRAPH: {
    label: 'Radiografía',
    icon: FileScan,
    className: 'bg-indigo-50 text-indigo-700',
  },
  DOCUMENT: {
    label: 'Documento',
    icon: FileText,
    className: 'bg-slate-100 text-slate-700',
  },
  PRESCRIPTION: {
    label: 'Receta',
    icon: Paperclip,
    className: 'bg-amber-50 text-amber-700',
  },
  EVOLUTION: {
    label: 'Evolución',
    icon: Stethoscope,
    className: 'bg-emerald-50 text-emerald-700',
  },
  OTHER: {
    label: 'Otro',
    icon: FolderOpen,
    className: 'bg-violet-50 text-violet-700',
  },
};

const categoryOptions = Object.entries(categoryPresentation) as Array<
  [MediaCategory, CategoryPresentation]
>;
const MAX_FILE_SIZE = 15 * 1024 * 1024;

export function MediaPage({
  initialPetId,
  initialMedicalRecordId,
  initialTreatmentId,
}: MediaPageProps) {
  const { request, requestBlob, user } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [media, setMedia] = useState<ClinicalMediaFile[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedPetId, setSelectedPetId] = useState(initialPetId ?? '');
  const [selectedTreatmentId, setSelectedTreatmentId] = useState(
    initialTreatmentId ?? '',
  );
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [isLoadingPets, setIsLoadingPets] = useState(true);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [previewing, setPreviewing] =
    useState<ClinicalMediaFile | null>(null);
  const [deletingMedia, setDeletingMedia] =
    useState<ClinicalMediaFile | null>(null);
  const canManage = user?.permissions.includes('medical.manage') ?? false;

  const loadPets = useCallback(async () => {
    setIsLoadingPets(true);
    try {
      const data = await request<PaginatedResponse<Pet>>(
        '/pets?page=1&pageSize=100&status=ACTIVE',
      );
      setPets(data.items);
      setSelectedPetId((current) => {
        if (initialPetId && data.items.some((pet) => pet.id === initialPetId)) {
          return initialPetId;
        }
        if (current && data.items.some((pet) => pet.id === current)) {
          return current;
        }
        return data.items[0]?.id ?? '';
      });
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No fue posible cargar los pacientes.',
      );
    } finally {
      setIsLoadingPets(false);
    }
  }, [initialPetId, request]);

  const loadRecords = useCallback(
    async (petId: string) => {
      if (!petId) {
        setRecords([]);
        return;
      }
      try {
        const data = await request<PaginatedResponse<MedicalRecord>>(
          `/medical-records?page=1&pageSize=100&petId=${petId}`,
        );
        setRecords(data.items);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'No fue posible cargar las atenciones clínicas.',
        );
      }
    },
    [request],
  );

  const loadMedia = useCallback(
    async (
      petId: string,
      term: string,
      category: string,
      treatmentId: string,
    ) => {
      if (!petId) {
        setMedia([]);
        setTotal(0);
        return;
      }
      setIsLoadingMedia(true);
      try {
        const query = new URLSearchParams({
          page: '1',
          pageSize: '100',
          petId,
          ...(term.trim() ? { search: term.trim() } : {}),
          ...(category ? { category } : {}),
          ...(treatmentId ? { treatmentId } : {}),
        });
        const data = await request<PaginatedResponse<ClinicalMediaFile>>(
          `/media?${query.toString()}`,
        );
        setMedia(data.items);
        setTotal(data.total);
        setError(null);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'No fue posible cargar los archivos clínicos.',
        );
      } finally {
        setIsLoadingMedia(false);
      }
    },
    [request],
  );

  useEffect(() => {
    void loadPets();
  }, [loadPets]);

  useEffect(() => {
    void loadRecords(selectedPetId);
  }, [loadRecords, selectedPetId]);

  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        void loadMedia(
          selectedPetId,
          search,
          categoryFilter,
          selectedTreatmentId,
        ),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [
    categoryFilter,
    loadMedia,
    search,
    selectedPetId,
    selectedTreatmentId,
  ]);

  const selectedPet =
    pets.find((pet) => pet.id === selectedPetId) ?? null;
  const imageCount = media.filter((item) =>
    item.mimeType.startsWith('image/'),
  ).length;
  const documentCount = media.filter(
    (item) => item.mimeType === 'application/pdf',
  ).length;
  const storageUsed = media.reduce(
    (sum, item) => sum + item.sizeBytes,
    0,
  );

  const handleDelete = async () => {
    if (!deletingMedia) return;
    try {
      await request(`/media/${deletingMedia.id}`, { method: 'DELETE' });
      setDeletingMedia(null);
      await loadMedia(
        selectedPetId,
        search,
        categoryFilter,
        selectedTreatmentId,
      );
    } catch (deleteError) {
      setDeletingMedia(null);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'No fue posible archivar el archivo.',
      );
    }
  };

  const handleDownload = async (item: ClinicalMediaFile) => {
    try {
      const blob = await requestBlob(item.contentUrl);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = item.originalName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : 'No fue posible descargar el archivo.',
      );
    }
  };

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">
            Evidencia clínica
          </p>
          <h1 className="mt-2 text-[28px] font-bold tracking-[-0.04em] text-slate-950">
            Imágenes y archivos
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Radiografías, fotografías, recetas y documentos organizados por
            paciente.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => setIsUploadOpen(true)}
            disabled={!selectedPetId}
            className="h-10 bg-teal-600 px-4 text-white hover:bg-teal-700"
          >
            <Plus className="size-4" />
            Subir archivo
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-start justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-rose-700"
            aria-label="Cerrar mensaje"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {isLoadingPets ? (
        <Card className="grid min-h-96 place-items-center text-slate-400">
          <LoaderCircle className="size-7 animate-spin" />
        </Card>
      ) : pets.length === 0 ? (
        <EmptyMedia hasPets={false} />
      ) : (
        <>
          <section className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
            <ClinicalMetric
              icon={Images}
              color="bg-teal-50 text-teal-600"
              value={total}
              label="Archivos del paciente"
            />
            <ClinicalMetric
              icon={FileImage}
              color="bg-cyan-50 text-cyan-600"
              value={imageCount}
              label="Imágenes visibles"
            />
            <ClinicalMetric
              icon={FileText}
              color="bg-violet-50 text-violet-600"
              value={documentCount}
              label="Documentos PDF"
            />
            <Card className="flex items-center gap-4 p-5">
              <div className="grid size-12 place-items-center rounded-xl bg-amber-50 text-amber-600">
                <HardDrive className="size-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {formatBytes(storageUsed)}
                </p>
                <p className="text-xs text-slate-500">Espacio visible</p>
              </div>
            </Card>
          </section>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-700">
                  <FolderOpen className="size-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">
                    Expediente visual
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {selectedPet
                      ? `${selectedPet.name} · ${selectedPet.breed || selectedPet.species}`
                      : 'Selecciona un paciente'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={selectedPetId}
                  onChange={(event) => {
                    setSelectedPetId(event.target.value);
                    setSelectedTreatmentId('');
                    setSearch('');
                    setCategoryFilter('');
                  }}
                  className={`${clinicalInputClass} w-52`}
                >
                  {pets.map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.name} · {pet.owner.lastName}
                    </option>
                  ))}
                </select>
                <select
                  value={categoryFilter}
                  onChange={(event) =>
                    setCategoryFilter(event.target.value)
                  }
                  className={`${clinicalInputClass} w-40`}
                >
                  <option value="">Todas las categorías</option>
                  {categoryOptions.map(([value, presentation]) => (
                    <option key={value} value={value}>
                      {presentation.label}
                    </option>
                  ))}
                </select>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar archivo o etiqueta..."
                    className={`${clinicalInputClass} pl-9`}
                  />
                </div>
              </div>
            </div>

            {isLoadingMedia ? (
              <div className="grid min-h-[420px] place-items-center text-slate-400">
                <LoaderCircle className="size-6 animate-spin" />
              </div>
            ) : media.length === 0 ? (
              <EmptyMedia
                hasPets
                filtered={Boolean(search || categoryFilter)}
                canManage={canManage}
                onUpload={() => setIsUploadOpen(true)}
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {media.map((item) => (
                  <MediaCard
                    key={item.id}
                    item={item}
                    canManage={canManage}
                    onPreview={() => setPreviewing(item)}
                    onDownload={() => void handleDownload(item)}
                    onDelete={() => setDeletingMedia(item)}
                  />
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {isUploadOpen && selectedPet && (
        <UploadMediaModal
          pet={selectedPet}
          records={records}
          initialMedicalRecordId={initialMedicalRecordId}
          treatmentEvidence={Boolean(selectedTreatmentId)}
          submitting={isUploading}
          onClose={() => setIsUploadOpen(false)}
          onSubmit={async ({ file, category, tags, medicalRecordId }) => {
            setIsUploading(true);
            setError(null);
            const body = new FormData();
            body.append('file', file);
            body.append('petId', selectedPet.id);
            body.append('category', category);
            if (tags.trim()) body.append('tags', tags);
            if (medicalRecordId) {
              body.append('medicalRecordId', medicalRecordId);
            }
            if (selectedTreatmentId) {
              body.append('treatmentId', selectedTreatmentId);
            }
            try {
              await request('/media', { method: 'POST', body });
              setIsUploadOpen(false);
              await loadMedia(
                selectedPet.id,
                search,
                categoryFilter,
                selectedTreatmentId,
              );
            } catch (uploadError) {
              setError(
                uploadError instanceof ApiError
                  ? uploadError.message
                  : 'No fue posible cargar el archivo.',
              );
            } finally {
              setIsUploading(false);
            }
          }}
        />
      )}

      {previewing && (
        <MediaPreviewModal
          item={previewing}
          onClose={() => setPreviewing(null)}
          onDownload={() => void handleDownload(previewing)}
        />
      )}

      {deletingMedia && (
        <ClinicalConfirmDialog
          title="Archivar archivo clínico"
          message={`${deletingMedia.originalName} dejará de aparecer en el expediente visual. La acción quedará registrada en auditoría.`}
          onCancel={() => setDeletingMedia(null)}
          onConfirm={() => void handleDelete()}
        />
      )}
    </>
  );
}

function MediaCard({
  item,
  canManage,
  onPreview,
  onDownload,
  onDelete,
}: {
  item: ClinicalMediaFile;
  canManage: boolean;
  onPreview: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const presentation = categoryPresentation[item.category];
  const CategoryIcon = presentation.icon;
  const isImage = item.mimeType.startsWith('image/');

  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg hover:shadow-slate-200/50">
      <button
        type="button"
        onClick={onPreview}
        className="relative block h-48 w-full overflow-hidden bg-slate-100 text-left"
      >
        {isImage ? (
          <ProtectedImage
            item={item}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-slate-50 to-violet-50">
            <div className="text-center">
              <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-white text-violet-600 shadow-sm">
                <FileText className="size-8" />
              </div>
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-violet-500">
                Documento PDF
              </p>
            </div>
          </div>
        )}
        <span className="absolute inset-0 grid place-items-center bg-slate-950/0 text-white opacity-0 transition group-hover:bg-slate-950/25 group-hover:opacity-100">
          <span className="flex items-center gap-2 rounded-xl bg-slate-950/70 px-3 py-2 text-xs font-semibold backdrop-blur-sm">
            <Eye className="size-4" />
            Vista previa
          </span>
        </span>
      </button>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Badge className={presentation.className}>
              <CategoryIcon className="mr-1 size-3" />
              {presentation.label}
            </Badge>
            <h3
              className="mt-2 truncate text-sm font-bold text-slate-800"
              title={item.originalName}
            >
              {item.originalName}
            </h3>
          </div>
          <div className="flex shrink-0 gap-1">
            <IconButton title="Descargar" onClick={onDownload}>
              <Download className="size-4" />
            </IconButton>
            {canManage && (
              <IconButton
                title="Archivar"
                onClick={onDelete}
                danger
              >
                <Trash2 className="size-4" />
              </IconButton>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <CalendarDays className="size-3.5" />
            {format(new Date(item.createdAt), 'd MMM yyyy', { locale: es })}
          </span>
          <span>{formatBytes(item.sizeBytes)}</span>
        </div>

        {item.medicalRecord && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2 text-[11px] text-teal-700">
            <Stethoscope className="size-3.5 shrink-0" />
            <span className="truncate">
              {item.medicalRecord.complaint || 'Atención clínica vinculada'}
            </span>
          </div>
        )}

        {item.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function ProtectedImage({
  item,
  className,
}: {
  item: ClinicalMediaFile;
  className: string;
}) {
  const { requestBlob } = useAuth();
  const [objectUrl, setObjectUrl] = useState<string>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let createdUrl: string | undefined;
    setFailed(false);
    void requestBlob(item.contentUrl)
      .then((blob) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [item.contentUrl, requestBlob]);

  if (failed) {
    return (
      <div className={`${className} grid place-items-center text-slate-400`}>
        <ImageOff className="size-8" />
      </div>
    );
  }
  if (!objectUrl) {
    return (
      <div className={`${className} grid place-items-center text-slate-300`}>
        <LoaderCircle className="size-5 animate-spin" />
      </div>
    );
  }
  return <img src={objectUrl} alt={item.originalName} className={className} />;
}

function UploadMediaModal({
  pet,
  records,
  initialMedicalRecordId,
  treatmentEvidence,
  submitting,
  onClose,
  onSubmit,
}: {
  pet: Pet;
  records: MedicalRecord[];
  initialMedicalRecordId?: string;
  treatmentEvidence?: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: {
    file: File;
    category: MediaCategory;
    tags: string;
    medicalRecordId: string;
  }) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<MediaCategory>(
    treatmentEvidence ? 'EVOLUTION' : 'OTHER',
  );
  const [tags, setTags] = useState('');
  const [medicalRecordId, setMedicalRecordId] = useState(
    initialMedicalRecordId &&
      records.some((record) => record.id === initialMedicalRecordId)
      ? initialMedicalRecordId
      : '',
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const selectFile = (selected?: File) => {
    if (!selected) return;
    if (selected.size > MAX_FILE_SIZE) {
      setLocalError('El archivo supera el límite permitido de 15 MB.');
      setFile(null);
      return;
    }
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];
    if (!allowed.includes(selected.type)) {
      setLocalError('Selecciona una imagen JPEG, PNG, WebP o un PDF.');
      setFile(null);
      return;
    }
    setFile(selected);
    setLocalError(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!file) {
      setLocalError('Selecciona un archivo para continuar.');
      return;
    }
    void onSubmit({ file, category, tags, medicalRecordId });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-6 backdrop-blur-sm">
      <Card className="max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6">
        <ClinicalModalHeader
          eyebrow="Expediente visual"
          title={`Subir archivo de ${pet.name}`}
          onClose={onClose}
        />
        <form onSubmit={submit} className="mt-6 space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="grid min-h-44 w-full place-items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 text-center transition hover:border-teal-300 hover:bg-teal-50/40"
          >
            <div>
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-teal-600 shadow-sm">
                <UploadCloud className="size-7" />
              </div>
              <p className="mt-3 text-sm font-bold text-slate-800">
                {file ? file.name : 'Selecciona una imagen o documento'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {file
                  ? `${formatBytes(file.size)} · listo para cargar`
                  : 'JPEG, PNG, WebP o PDF · máximo 15 MB'}
              </p>
            </div>
          </button>

          {localError && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {localError}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <ClinicalField label="Categoría">
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as MediaCategory)
                }
                className={clinicalInputClass}
              >
                {categoryOptions.map(([value, presentation]) => (
                  <option key={value} value={value}>
                    {presentation.label}
                  </option>
                ))}
              </select>
            </ClinicalField>
            <ClinicalField label="Atención clínica" optional>
              <select
                value={medicalRecordId}
                onChange={(event) => setMedicalRecordId(event.target.value)}
                className={clinicalInputClass}
              >
                <option value="">Archivo general del paciente</option>
                {records.map((record) => (
                  <option key={record.id} value={record.id}>
                    {format(new Date(record.occurredAt), 'dd/MM/yyyy')} ·{' '}
                    {record.complaint || 'Atención clínica'}
                  </option>
                ))}
              </select>
            </ClinicalField>
          </div>

          <ClinicalField label="Etiquetas" optional>
            <div className="relative">
              <Tag className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                value={tags}
                maxLength={500}
                onChange={(event) => setTags(event.target.value)}
                placeholder="herida, control, antes"
                className={`${clinicalInputClass} pl-10`}
              />
            </div>
          </ClinicalField>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              onClick={onClose}
              className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting || !file}
              className="bg-teal-600 text-white hover:bg-teal-700"
            >
              {submitting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <UploadCloud className="size-4" />
              )}
              Guardar en expediente
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function MediaPreviewModal({
  item,
  onClose,
  onDownload,
}: {
  item: ClinicalMediaFile;
  onClose: () => void;
  onDownload: () => void;
}) {
  const { requestBlob } = useAuth();
  const [objectUrl, setObjectUrl] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    let createdUrl: string | undefined;
    void requestBlob(item.contentUrl)
      .then((blob) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'No fue posible abrir el archivo.',
          );
        }
      });
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [item.contentUrl, requestBlob]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950/90 backdrop-blur-md">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-5 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {item.originalName}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {item.pet.name} · {formatBytes(item.sizeBytes)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDownload}
            className="flex h-9 items-center gap-2 rounded-xl bg-white/10 px-3 text-xs font-semibold hover:bg-white/20"
          >
            <Download className="size-4" />
            Descargar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-xl bg-white/10 hover:bg-white/20"
            aria-label="Cerrar vista previa"
          >
            <X className="size-5" />
          </button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 place-items-center p-6">
        {error ? (
          <div className="text-center text-slate-300">
            <ImageOff className="mx-auto size-10" />
            <p className="mt-3 text-sm">{error}</p>
          </div>
        ) : !objectUrl ? (
          <LoaderCircle className="size-8 animate-spin text-white" />
        ) : item.mimeType.startsWith('image/') ? (
          <img
            src={objectUrl}
            alt={item.originalName}
            className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
          />
        ) : (
          <iframe
            src={objectUrl}
            title={item.originalName}
            className="h-full w-full max-w-6xl rounded-xl bg-white"
          />
        )}
      </div>
    </div>
  );
}

function IconButton({
  title,
  onClick,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={
        danger
          ? 'grid size-8 place-items-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-600'
          : 'grid size-8 place-items-center rounded-lg text-slate-300 hover:bg-teal-50 hover:text-teal-700'
      }
    >
      {children}
    </button>
  );
}

function EmptyMedia({
  hasPets,
  filtered = false,
  canManage = false,
  onUpload,
}: {
  hasPets: boolean;
  filtered?: boolean;
  canManage?: boolean;
  onUpload?: () => void;
}) {
  return (
    <Card
      className={
        hasPets
          ? 'grid min-h-[420px] place-items-center border-0 shadow-none'
          : 'grid min-h-96 place-items-center'
      }
    >
      <div className="px-6 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-teal-50 text-teal-600">
          {filtered ? (
            <Search className="size-8" />
          ) : (
            <Images className="size-8" />
          )}
        </div>
        <h2 className="mt-4 font-bold text-slate-800">
          {!hasPets
            ? 'Primero registra un paciente'
            : filtered
              ? 'No hay archivos con este filtro'
              : 'El expediente visual está vacío'}
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          {!hasPets
            ? 'Los archivos clínicos siempre deben pertenecer a una mascota.'
            : filtered
              ? 'Prueba con otra categoría o término de búsqueda.'
              : 'Añade fotografías, radiografías, recetas o documentos PDF.'}
        </p>
        {hasPets && canManage && !filtered && onUpload && (
          <Button
            onClick={onUpload}
            className="mt-5 bg-teal-600 text-white hover:bg-teal-700"
          >
            <UploadCloud className="size-4" />
            Subir primer archivo
          </Button>
        )}
      </div>
    </Card>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}
