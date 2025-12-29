import { Sidebar } from '@/components/binly/sidebar';
import { MapProvider } from '@/components/binly/map-provider';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MapProvider>
      <div className="flex h-screen overflow-hidden bg-[#F4F5F9]">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Main Content */}
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </MapProvider>
  );
}
