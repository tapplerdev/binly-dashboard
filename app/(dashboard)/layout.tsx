'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/binly/sidebar';
import { MobileBottomNav } from '@/components/binly/mobile-bottom-nav';
import { MapProvider } from '@/components/binly/map-provider';
import { TopNavBar } from '@/components/binly/top-nav-bar';
import { AIAssistantDrawer } from '@/components/binly/ai-assistant-drawer';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAIDrawerOpen, setIsAIDrawerOpen] = useState(false);
  const [isAIDrawerClosing, setIsAIDrawerClosing] = useState(false);

  const handleCloseAIDrawer = () => {
    setIsAIDrawerClosing(true);
    setTimeout(() => {
      setIsAIDrawerOpen(false);
      setIsAIDrawerClosing(false);
    }, 300); // Match animation duration
  };

  return (
    <MapProvider>
      <div className="flex h-screen overflow-hidden bg-gray-100 relative">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Top Navigation Bar */}
          <TopNavBar onOpenAIAssistant={() => setIsAIDrawerOpen(true)} />

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto relative">
            {children}
          </main>
        </div>

        {/* Mobile Bottom Navigation - Hidden (replaced with hamburger menu) */}
        {/* <MobileBottomNav /> */}

        {/* AI Assistant Drawer - Full screen overlay */}
        {isAIDrawerOpen && (
          <>
            {/* Backdrop - Covers entire screen including sidebar and top nav */}
            <div
              className="fixed inset-0 bg-black/30 z-40 animate-fade-in"
              onClick={handleCloseAIDrawer}
            />
            {/* Drawer */}
            <div className="fixed top-0 right-0 h-full z-50">
              <AIAssistantDrawer
                onClose={handleCloseAIDrawer}
                isClosing={isAIDrawerClosing}
              />
            </div>
          </>
        )}
      </div>
    </MapProvider>
  );
}
