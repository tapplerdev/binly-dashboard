import { ClientOnly } from '@/components/binly/client-only';
import { ExpansionPlannerView } from '@/components/binly/expansion-planner-view';

export default function PlannerPage() {
  return (
    <ClientOnly>
      <ExpansionPlannerView />
    </ClientOnly>
  );
}
