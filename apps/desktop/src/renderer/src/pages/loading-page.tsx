import { LoaderCircle } from 'lucide-react';
import logoUrl from '@/assets/vetcare-logo.svg';

export function LoadingPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f7f9fb]">
      <div className="text-center">
        <img
          src={logoUrl}
          alt="VetCare Pro"
          className="mx-auto size-20 drop-shadow-xl"
          draggable={false}
        />
        <p className="mt-5 text-xl font-bold tracking-[-0.03em] text-slate-800">
          VetCare <span className="text-teal-600">Pro</span>
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-400">
          <LoaderCircle className="size-4 animate-spin" />
          Preparando tu sesión segura
        </div>
      </div>
    </div>
  );
}

