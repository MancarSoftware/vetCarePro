import { Button } from '@/components/ui/button';
import { useRuntimeConfig } from '@/contexts/runtime-config-context';
import { MonitorCog } from 'lucide-react';

const runtimeModeLabels: Record<VetCareRuntimeMode, string> = {
  local: 'Una sola PC',
  'lan-server': 'Servidor LAN',
  'lan-client': 'Cliente LAN',
};

export function RuntimeConnectionPanel() {
  const { config, openConfigurator } = useRuntimeConfig();

  return (
    <div className="mb-5 rounded-2xl border border-teal-100 bg-teal-50/70 p-4">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-teal-700 shadow-sm">
          <MonitorCog className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Conexion actual
          </p>
          <p className="mt-1 text-sm font-black text-slate-900">
            {runtimeModeLabels[config.mode]}
          </p>
          <p className="mt-1 break-all font-mono text-xs font-semibold text-slate-500">
            {config.apiBaseUrl}
          </p>
        </div>
      </div>
      <Button
        type="button"
        onClick={openConfigurator}
        className="mt-3 h-10 w-full rounded-xl border border-teal-200 bg-white text-teal-700 hover:bg-teal-50"
      >
        Cambiar configuracion de conexion
      </Button>
    </div>
  );
}
