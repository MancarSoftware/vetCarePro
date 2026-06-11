import { Bell, ChevronDown, Search, UserRound } from 'lucide-react';

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex h-[76px] items-center border-b border-slate-200 bg-white/95 px-7 backdrop-blur">
      <div className="relative mx-auto w-full max-w-2xl">
        <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          disabled
          placeholder="Buscar mascotas, dueños, citas, tratamientos..."
          title="La búsqueda estará disponible al implementar los módulos clínicos"
          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-12 pr-20 text-sm text-slate-600 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-400">
          Ctrl + K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-5 pl-8">
        <div className="relative grid size-10 place-items-center rounded-full text-slate-600">
          <Bell className="size-5" />
          <span className="absolute right-0 top-0 grid size-4 place-items-center rounded-full bg-teal-600 text-[9px] font-bold text-white">
            0
          </span>
        </div>
        <div className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-teal-100 to-cyan-100 text-teal-700">
          <UserRound className="size-5" />
        </div>
        <div className="hidden min-w-32 xl:block">
          <p className="text-sm font-bold text-slate-800">Equipo VetCare</p>
          <p className="text-xs text-slate-500">Configuración inicial</p>
        </div>
        <ChevronDown className="size-4 text-slate-500" />
      </div>
    </header>
  );
}

