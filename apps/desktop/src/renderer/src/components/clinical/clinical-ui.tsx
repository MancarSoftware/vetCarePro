import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';
import { Trash2, X } from 'lucide-react';
import type { ReactNode } from 'react';

export const clinicalInputClass =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10';

export function ClinicalMetric({
  icon: Icon,
  color,
  value,
  label,
}: {
  icon: LucideIcon;
  color: string;
  value: number;
  label: string;
}) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className={`grid size-12 place-items-center rounded-xl ${color}`}>
        <Icon className="size-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </Card>
  );
}

export function ClinicalField({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
        {optional && (
          <span className="ml-1 font-normal text-slate-400">(opcional)</span>
        )}
      </span>
      {children}
    </label>
  );
}

export function ClinicalModalHeader({
  eyebrow,
  title,
  onClose,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-600">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-xl font-bold text-slate-900">{title}</h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
      >
        <X className="size-5" />
      </button>
    </div>
  );
}

export function ClinicalConfirmDialog({
  title,
  message,
  disabled,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-6 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6">
        <div className="grid size-11 place-items-center rounded-xl bg-rose-50 text-rose-600">
          <Trash2 className="size-5" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            onClick={onCancel}
            className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={disabled}
            className="bg-rose-600 text-white hover:bg-rose-700"
          >
            Archivar
          </Button>
        </div>
      </Card>
    </div>
  );
}
