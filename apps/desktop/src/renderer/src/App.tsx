import {
  Sidebar,
  type AppPage,
} from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { AppointmentsPage } from '@/pages/appointments-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { LoadingPage } from '@/pages/loading-page';
import { LoginPage } from '@/pages/login-page';
import { MediaPage } from '@/pages/media-page';
import { MedicalHistoryPage } from '@/pages/medical-history-page';
import { OwnersPage } from '@/pages/owners-page';
import { PetsPage } from '@/pages/pets-page';
import { PreventiveCarePage } from '@/pages/preventive-care-page';
import { SetupPage } from '@/pages/setup-page';
import { UsersPage } from '@/pages/users-page';
import { useState } from 'react';

function AuthenticatedApp() {
  const { user, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState<AppPage>('dashboard');
  const [historyPetId, setHistoryPetId] = useState<string>();
  const [appointmentPetId, setAppointmentPetId] = useState<string>();
  const [preventivePetId, setPreventivePetId] = useState<string>();
  const [mediaTarget, setMediaTarget] = useState<{
    petId?: string;
    medicalRecordId?: string;
  }>({});

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
          onOpenMedia={(petId) => {
            setMediaTarget({ petId });
            setCurrentPage('media');
          }}
          onOpenPreventive={(petId) => {
            setPreventivePetId(petId);
            setCurrentPage('preventive');
          }}
          onOpenAppointments={(petId) => {
            setAppointmentPetId(petId);
            setCurrentPage('appointments');
          }}
        />
      );
    }
    if (currentPage === 'owners') return <OwnersPage />;
    if (currentPage === 'appointments') {
      return (
        <AppointmentsPage
          initialPetId={appointmentPetId}
          onOpenHistory={(petId) => {
            setHistoryPetId(petId);
            setCurrentPage('history');
          }}
        />
      );
    }
    if (currentPage === 'history') {
      return (
        <MedicalHistoryPage
          initialPetId={historyPetId}
          onOpenMedia={(petId, medicalRecordId) => {
            setMediaTarget({ petId, medicalRecordId });
            setCurrentPage('media');
          }}
          onOpenPreventive={(petId) => {
            setPreventivePetId(petId);
            setCurrentPage('preventive');
          }}
        />
      );
    }
    if (currentPage === 'media') {
      return (
        <MediaPage
          initialPetId={mediaTarget.petId}
          initialMedicalRecordId={mediaTarget.medicalRecordId}
        />
      );
    }
    if (currentPage === 'preventive') {
      return <PreventiveCarePage initialPetId={preventivePetId} />;
    }
    if (currentPage === 'users') return <UsersPage />;
    return (
      <DashboardPage
        onOpenAppointments={() => {
          setAppointmentPetId(undefined);
          setCurrentPage('appointments');
        }}
        onOpenPreventive={() => {
          setPreventivePetId(undefined);
          setCurrentPage('preventive');
        }}
      />
    );
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-slate-900">
      <Sidebar
        currentPage={currentPage}
        onNavigate={(page) => {
          if (page === 'appointments') {
            setAppointmentPetId(undefined);
          }
          setCurrentPage(page);
        }}
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
