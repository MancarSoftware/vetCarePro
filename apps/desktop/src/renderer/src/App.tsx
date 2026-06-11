import {
  Sidebar,
  type AppPage,
} from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { DashboardPage } from '@/pages/dashboard-page';
import { LoadingPage } from '@/pages/loading-page';
import { LoginPage } from '@/pages/login-page';
import { SetupPage } from '@/pages/setup-page';
import { UsersPage } from '@/pages/users-page';
import { useState } from 'react';

function AuthenticatedApp() {
  const { user, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState<AppPage>('dashboard');

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-slate-900">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        user={user}
      />
      <div className="min-h-screen pl-[246px]">
        <Topbar user={user} onLogout={logout} />
        <main className="mx-auto w-full max-w-[1740px] px-7 pb-8 pt-6">
          {currentPage === 'dashboard' ? <DashboardPage /> : <UsersPage />}
        </main>
      </div>
    </div>
  );
}

function AppContent() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <LoadingPage />;
  }
  if (status === 'setup-required') {
    return <SetupPage />;
  }
  if (status === 'unauthenticated') {
    return <LoginPage />;
  }
  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
