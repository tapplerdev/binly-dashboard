import { ClientOnly } from '@/components/binly/client-only';
import { IntelligenceView } from '@/components/binly/intelligence-view';

export default function IntelligencePage() {
  return (
    <ClientOnly>
      <IntelligenceView />
    </ClientOnly>
  );
}
