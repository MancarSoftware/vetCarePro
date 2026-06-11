import { HeartHandshake, LoaderCircle } from 'lucide-react';

export function LoadingPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f7f9fb]">
      <div className="text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-teal-600 text-white shadow-xl shadow-teal-600/20">
          <HeartHandshake className="size-8" />
        </div>
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

