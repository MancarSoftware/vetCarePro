import type { AppPage } from '@/components/layout/sidebar';

export interface NavigationTarget {
  page: AppPage;
  petId?: string;
  ownerId?: string;
  recordId?: string;
  appointmentId?: string;
  treatmentId?: string;
  mediaId?: string;
  paymentId?: string;
  productId?: string;
}

export interface GlobalSearchResult {
  id: string;
  type:
    | 'pet'
    | 'owner'
    | 'appointment'
    | 'medical-record'
    | 'media'
    | 'vaccine'
    | 'treatment'
    | 'payment'
    | 'inventory';
  title: string;
  subtitle: string;
  description: string | null;
  target: NavigationTarget;
}

export interface GlobalSearchResponse {
  query: string;
  items: GlobalSearchResult[];
}
