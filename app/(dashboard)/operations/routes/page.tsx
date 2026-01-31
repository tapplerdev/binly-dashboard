import { BinTemplateBuilder } from '@/components/binly/bin-template-builder';

export const metadata = {
  title: 'Route Templates - Binly Dashboard',
  description: 'Create and manage bin collection templates',
};

export default function RoutesPage() {
  return <BinTemplateBuilder />;
}
