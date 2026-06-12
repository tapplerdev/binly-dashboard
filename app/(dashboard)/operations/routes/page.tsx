import dynamic from 'next/dynamic';

const BinTemplateBuilder = dynamic(
  () => import('@/components/binly/bin-template-builder').then(mod => ({ default: mod.BinTemplateBuilder })),
  { ssr: false }
);

export const metadata = {
  title: 'Route Templates - Binly Dashboard',
  description: 'Create and manage bin collection templates',
};

export default function RoutesPage() {
  return <BinTemplateBuilder />;
}
