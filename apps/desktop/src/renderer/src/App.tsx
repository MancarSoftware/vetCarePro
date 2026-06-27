import {
  Sidebar,
  type AppPage,
} from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { RuntimeConfigProvider } from '@/contexts/runtime-config-context';
import { AppointmentsPage } from '@/pages/appointments-page';
import { BackupsPage } from '@/pages/backups-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { FinancePage } from '@/pages/finance-page';
import { LoadingPage } from '@/pages/loading-page';
import { LoginPage } from '@/pages/login-page';
import { InventoryPage } from '@/pages/inventory-page';
import { MediaPage } from '@/pages/media-page';
import { MedicalHistoryPage } from '@/pages/medical-history-page';
import { OwnersPage } from '@/pages/owners-page';
import { PaymentsPage } from '@/pages/payments-page';
import { PetsPage } from '@/pages/pets-page';
import { PreventiveCarePage } from '@/pages/preventive-care-page';
import { ReportsPage } from '@/pages/reports-page';
import { SettingsPage } from '@/pages/settings-page';
import { SetupPage } from '@/pages/setup-page';
import { TreatmentsPage } from '@/pages/treatments-page';
import { UsersPage } from '@/pages/users-page';
import type { NavigationTarget } from '@/types/global-search';
import { useState } from 'react';

function AuthenticatedApp() {
  const { user, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState<AppPage>('dashboard');
  const [historyPetId, setHistoryPetId] = useState<string>();
  const [appointmentPetId, setAppointmentPetId] = useState<string>();
  const [paymentAppointmentId, setPaymentAppointmentId] = useState<string>();
  const [preventivePetId, setPreventivePetId] = useState<string>();
  const [treatmentTarget, setTreatmentTarget] = useState<{
    petId?: string;
    medicalRecordId?: string;
  }>({});
  const [mediaTarget, setMediaTarget] = useState<{
    petId?: string;
    medicalRecordId?: string;
    treatmentId?: string;
  }>({});

  if (!user) {
    return null;
  }

  const navigateToTarget = (target: NavigationTarget) => {
    setHistoryPetId(undefined);
    setAppointmentPetId(undefined);
    setPaymentAppointmentId(undefined);
    setPreventivePetId(undefined);
    setTreatmentTarget({});
    setMediaTarget({});

    if (target.page === 'history') {
      setHistoryPetId(target.petId);
    }
    if (target.page === 'appointments') {
      setAppointmentPetId(target.petId);
    }
    if (target.page === 'preventive') {
      setPreventivePetId(target.petId);
    }
    if (target.page === 'treatments') {
      setTreatmentTarget({
        petId: target.petId,
        medicalRecordId: target.recordId,
      });
    }
    if (target.page === 'media') {
      setMediaTarget({
        petId: target.petId,
        medicalRecordId: target.recordId,
        treatmentId: target.treatmentId,
      });
    }

    setCurrentPage(target.page);
  };

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
          onOpenTreatments={(petId) => {
            setTreatmentTarget({ petId });
            setCurrentPage('treatments');
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
          onCollectPayment={(appointmentId) => {
            setPaymentAppointmentId(appointmentId);
            setCurrentPage('payments');
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
          onOpenTreatments={(petId, medicalRecordId) => {
            setTreatmentTarget({ petId, medicalRecordId });
            setCurrentPage('treatments');
          }}
        />
      );
    }
    if (currentPage === 'media') {
      return (
        <MediaPage
          initialPetId={mediaTarget.petId}
          initialMedicalRecordId={mediaTarget.medicalRecordId}
          initialTreatmentId={mediaTarget.treatmentId}
        />
      );
    }
    if (currentPage === 'preventive') {
      return <PreventiveCarePage initialPetId={preventivePetId} />;
    }
    if (currentPage === 'treatments') {
      return (
        <TreatmentsPage
          initialPetId={treatmentTarget.petId}
          initialMedicalRecordId={treatmentTarget.medicalRecordId}
          onOpenHistory={(petId) => {
            setHistoryPetId(petId);
            setCurrentPage('history');
          }}
          onOpenMedia={(petId, treatmentId) => {
            setMediaTarget({ petId, treatmentId });
            setCurrentPage('media');
          }}
        />
      );
    }
    if (currentPage === 'inventory') return <InventoryPage />;
    if (currentPage === 'payments') {
      return (
        <PaymentsPage
          initialAppointmentId={paymentAppointmentId}
          onInitialAppointmentHandled={() => setPaymentAppointmentId(undefined)}
        />
      );
    }
    if (currentPage === 'finance') return <FinancePage />;
    if (currentPage === 'reports') return <ReportsPage />;
    if (currentPage === 'backups') return <BackupsPage />;
    if (currentPage === 'users') return <UsersPage />;
    if (currentPage === 'settings') return <SettingsPage />;
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
        onOpenTreatments={() => {
          setTreatmentTarget({});
          setCurrentPage('treatments');
        }}
        onOpenInventory={() => setCurrentPage('inventory')}
        onOpenPayments={() => setCurrentPage('payments')}
        onOpenFinance={() => setCurrentPage('finance')}
      />
    );
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-slate-900">
      <Sidebar
        currentPage={currentPage}
        onNavigate={(page) => navigateToTarget({ page })}
        user={user}
      />
      <div className="min-h-screen pl-[246px]">
        <Topbar
          user={user}
          onLogout={logout}
          onNavigate={navigateToTarget}
        />
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
    <RuntimeConfigProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </RuntimeConfigProvider>
  );
}
