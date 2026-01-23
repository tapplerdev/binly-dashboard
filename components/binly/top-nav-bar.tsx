'use client';

import { Search, Sparkles, Bell, Settings, LogOut, ChevronDown, Menu, X, Home, Map, Package, Brain, User } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/auth/store';
import { cn } from '@/lib/utils';

interface TopNavBarProps {
  onOpenAIAssistant: () => void;
}

export function TopNavBar({ onOpenAIAssistant }: TopNavBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();

  const userInitial = user?.name?.charAt(0).toUpperCase() || 'U';

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }

    if (profileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileOpen]);

  const mainNavItems = [
    { key: 'home', title: 'Home', icon: Home, path: '/' },
    { key: 'operations', title: 'Operations', icon: Map, path: '/operations/live-map' },
    { key: 'inventory', title: 'Inventory', icon: Package, path: '/administration/inventory' },
    { key: 'intelligence', title: 'Intelligence', icon: Brain, path: '/intelligence/analytics' },
    { key: 'profile', title: 'Profile', icon: User, path: '/profile' },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  return (
    <>
      <div className="h-16 bg-white flex items-center justify-between px-4 lg:px-6 shrink-0 border-b border-gray-200 shadow-sm">
        {/* Left side - Hamburger (Mobile) or Search (Desktop) */}
        <div className="flex-1 max-w-xs">
          {/* Mobile: Hamburger */}
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="lg:hidden p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Navigation Menu"
          >
            <Menu className="w-6 h-6 text-gray-700" />
          </button>

          {/* Desktop: Search */}
          <div className="hidden lg:block relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-gray-300 focus:bg-white transition-all bg-gray-50/30 hover:bg-gray-50/50 shadow-sm"
              placeholder="Search"
            />
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2 lg:gap-3 ml-4 lg:ml-6">
        {/* AI Assistant */}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenAIAssistant}
          className="gap-2 border-gray-200 hover:bg-gray-50"
        >
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="hidden lg:inline text-sm font-medium">AI Assistant</span>
        </Button>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <Bell className="w-5 h-5 text-gray-600" />
          {/* Notification badge */}
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          {/* Profile Button */}
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5E9646] to-[#4AA0B5] flex items-center justify-center text-white font-bold text-sm">
              {userInitial}
            </div>
            <ChevronDown
              className={cn(
                'w-4 h-4 text-gray-400 transition-transform duration-200',
                profileOpen && 'rotate-180'
              )}
            />
          </button>

          {/* Dropdown Menu */}
          {profileOpen && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden animate-scale-in z-50">
              <button
                onClick={() => {
                  console.log('Settings clicked');
                  setProfileOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-[#EDF0FF] hover:text-[#4880FF] transition-colors duration-150"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <button
                onClick={() => {
                  handleLogout();
                  setProfileOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors duration-150 border-t border-gray-100"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Mobile Navigation Drawer */}
      {mobileNavOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40 animate-fade-in lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />

          {/* Drawer */}
          <div className="fixed top-0 left-0 bottom-0 w-72 bg-white shadow-2xl z-50 animate-slide-in-left lg:hidden flex flex-col">
            {/* Header */}
            <div className="px-5 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Menu</h2>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      router.push(item.path);
                      setMobileNavOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                      active
                        ? 'bg-primary text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-50 active:scale-[0.98]'
                    )}
                  >
                    <div className={cn(
                      'p-2 rounded-lg',
                      active ? 'bg-white/20' : 'bg-gray-100'
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[15px] font-semibold">{item.title}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
