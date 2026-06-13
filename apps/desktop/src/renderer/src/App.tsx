import {
  Sidebar,
  type AppPage,
} from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { DashboardPage } from '@/pages/dashboard-page';
import { LoadingPage } from '@/pages/loading-page';
import { LoginPage } from '@/pages/login-page';
import { MedicalHistoryPage } from '@/pages/medical-history-page';
import { OwnersPage } from '@/pages/owners-page';
import { PetsPage } from '@/pages/pets-page';
import { SetupPage } from '@/pages/setup-page';
import { UsersPage } from '@/pages/users-page';
import { useState } from 'react';

function AuthenticatedApp() {
  const { user, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState<AppPage>('dashboard');
  const [historyPetId, setHistoryPetId] = useState<string>();

  if (!user) {
    return null;
  }

  const renderPage = () => {
    if (currentPage === 'pets') {
      return (
        <PetsPage
          onOpenHistory={(petId) => {
            setHistoryPetId(petId);
            setCurrentPage('history');
          }}
        />
      );
    }
    if (currentPage === 'owners') return <OwnersPage />;
    if (currentPage === 'history') {
      return <MedicalHistoryPage initialPetId={historyPetId} />;
    }
    if (currentPage === 'users') return <UsersPage />;
    return <DashboardPage />;
  };

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
          {renderPage()}
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
