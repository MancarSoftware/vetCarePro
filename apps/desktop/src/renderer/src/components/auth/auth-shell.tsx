import { HeartHandshake, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-white lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-teal-700 via-teal-600 to-cyan-600 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -left-28 top-28 size-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 right-0 size-96 rounded-full bg-cyan-300/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-white/15 backdrop-blur">
            <HeartHandshake className="size-7" />
          </div>
          <div className="text-2xl font-bold tracking-[-0.03em]">
            VetCare Pro
          </div>
        </div>

        <div className="relative my-auto max-w-xl">
          <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em]">
            Gestión clínica local
          </span>
          <h2 className="mt-7 text-5xl font-bold leading-[1.08] tracking-[-0.05em]">
            Tu clínica organizada, segura y siempre disponible.
          </h2>
          <p className="mt-6 max-w-lg text-base leading-7 text-teal-50/85">
            Los datos permanecen en este equipo. VetCare Pro funciona sin
            internet y protege el acceso mediante usuarios, roles y sesiones
            cifradas.
          </p>

          <div className="mt-10 flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
            <div className="grid size-11 place-items-center rounded-xl bg-white text-teal-700">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold">Seguridad local integrada</p>
              <p className="mt-1 text-xs text-teal-50/75">
                Contraseñas con bcrypt y sesión cifrada por Windows
              </p>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-teal-50/60">
          VetCare Pro · Versión 0.1.0
        </p>
      </section>

      <main className="flex min-h-screen items-center justify-center bg-[#f7f9fb] px-6 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3 text-xl font-bold text-slate-800">
              <div className="grid size-10 place-items-center rounded-xl bg-teal-600 text-white">
                <HeartHandshake className="size-5" />
              </div>
              VetCare <span className="-ml-2 text-teal-600">Pro</span>
            </div>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            {description}
          </p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

