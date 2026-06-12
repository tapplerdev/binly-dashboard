import { ClientOnly } from '@/components/binly/client-only';
import { BinTemplateBuilder } from '@/components/binly/bin-template-builder';

export default function RoutesPage() {
  return (
    <ClientOnly>
      <BinTemplateBuilder />
    </ClientOnly>
  );
}
