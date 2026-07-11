import { Suspense } from 'react';
import { ShiftsBoardView } from '@/components/binly/shifts-board-view';

export const metadata = {
  title: 'Shifts - Binly Dashboard',
  description: 'Shift scheduling and management',
};

export default function ShiftsPage() {
  // Suspense: ShiftsBoardView reads useSearchParams (incident deep links)
  return (
    <Suspense>
      <ShiftsBoardView />
    </Suspense>
  );
}
