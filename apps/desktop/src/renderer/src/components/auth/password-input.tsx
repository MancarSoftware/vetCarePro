import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useState, type InputHTMLAttributes } from 'react';

export function PasswordInput(
  props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>,
) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <LockKeyhole className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-11 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

