import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { DashboardPage } from '@/pages/dashboard-page';

export default function App() {
  return (
    <div className="min-h-screen bg-[#f7f9fb] text-slate-900">
      <Sidebar />
      <div className="min-h-screen pl-[246px]">
        <Topbar />
        <main className="mx-auto w-full max-w-[1740px] px-7 pb-8 pt-6">
          <DashboardPage />
        </main>
      </div>
    </div>
  );
}

