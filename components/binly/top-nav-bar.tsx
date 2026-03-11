'use client';

import {
  Search, Sparkles, Bell, Settings, LogOut, ChevronDown, Menu, X,
  ChevronUp, MapPin, Clock, Truck, ArrowRightLeft, CheckCheck, MapPinPlus,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/auth/store';
import { useNotificationStore } from '@/lib/stores/notification-store';
import { useNotifications, useUnreadCount, useMarkRead, useMarkAllRead } from '@/lib/hooks/use-notifications';
import type { UserNotification } from '@/lib/api/notifications';
import { cn } from '@/lib/utils';
import { sidebarNavItems } from './sidebar-nav-items';

function getNotifIcon(type: string) {
  if (type.startsWith('bin_drift')) return { icon: MapPin, bg: 'bg-red-100', color: 'text-red-600' };
  if (type.startsWith('digest_')) return { icon: Clock, bg: 'bg-blue-100', color: 'text-blue-600' };
  if (type.includes('shift')) return { icon: Truck, bg: 'bg-green-100', color: 'text-green-600' };
  if (type.includes('move_request')) return { icon: ArrowRightLeft, bg: 'bg-amber-100', color: 'text-amber-600' };
  if (type.includes('potential_location')) return { icon: MapPinPlus, bg: 'bg-violet-100', color: 'text-violet-600' };
  return { icon: Bell, bg: 'bg-gray-100', color: 'text-gray-600' };
}

function relativeTime(epochSeconds: number) {
  const diff = Math.floor(Date.now() / 1000) - epochSeconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function NotificationRow({ notif, onRead }: { notif: UserNotification; onRead: () => void }) {
  const { icon: Icon, bg, color } = getNotifIcon(notif.type);
  return (
    <div
      onClick={onRead}
      className={cn(
        'px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer',
        !notif.read_at && 'bg-blue-50/50'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 p-1.5 rounded-lg shrink-0', bg, color)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">{notif.title}</p>
            {!notif.read_at && (
              <span className="mt-1 w-2 h-2 rounded-full bg-primary shrink-0" />
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{notif.body}</p>
          <p className="text-[10px] text-gray-300 mt-1">{relativeTime(notif.created_at)}</p>
        </div>
      </div>
    </div>
  );
}

interface TopNavBarProps {
  onOpenAIAssistant: () => void;
}

export function TopNavBar({ onOpenAIAssistant }: TopNavBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();
  // DB-backed notifications
  const { data: notifData } = useNotifications(1);
  const { data: unreadData } = useUnreadCount();
  const markReadMutation = useMarkRead();
  const markAllReadMutation = useMarkAllRead();
  const store = useNotificationStore();

  // Hydrate store from API on first load
  useEffect(() => {
    if (notifData && unreadData && !store.isHydrated) {
      store.hydrate(notifData.notifications, unreadData.unread_count);
    }
  }, [notifData, unreadData, store]);

  // Keep unread count in sync with API
  useEffect(() => {
    if (unreadData) {
      store.setUnreadCount(unreadData.unread_count);
    }
  }, [unreadData, store]);

  const notifications = store.isHydrated ? store.notifications : (notifData?.notifications ?? []);
  const unreadCount = store.unreadCount;

  const userInitial = user?.name?.charAt(0).toUpperCase() || 'U';

  // Find which section contains the current path for default open state
  const defaultOpenSection = sidebarNavItems.find((section) =>
    section.children.some((item) => item.path === pathname)
  );

  // State for expandable sections in mobile nav
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(defaultOpenSection ? [defaultOpenSection.key] : [])
  );

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }

    if (profileOpen || notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileOpen, notificationsOpen]);

  const isActive = (path?: string) => {
    if (!path) return false;
    if (path === '/') {
      return pathname === '/';
    }
    return pathname === path;
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
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Bell className="w-5 h-5 text-gray-600" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-[10px] font-bold text-white leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-scale-in z-50">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={() => {
                      store.markAllRead();
                      markAllReadMutation.mutate();
                    }}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-400">
                    No notifications yet
                  </div>
                ) : (
                  notifications.slice(0, 20).map((notif) => (
                    <NotificationRow
                      key={notif.id}
                      notif={notif}
                      onRead={() => {
                        if (!notif.read_at) {
                          store.markRead(notif.id);
                          markReadMutation.mutate(notif.id);
                        }
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>

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
                  router.push('/settings');
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

            {/* Navigation Items with Expandable Sections */}
            <nav className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
              {sidebarNavItems.map((section) => (
                <div key={section.key}>
                  {/* Section Header */}
                  <button
                    onClick={() => section.children.length > 1 && toggleSection(section.key)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-left',
                      section.children.length > 1 && 'cursor-pointer hover:bg-gray-50 rounded-lg transition-colors'
                    )}
                  >
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      {section.title}
                    </h3>
                    {section.children.length > 1 && (
                      <ChevronUp
                        className={cn(
                          'w-4 h-4 text-gray-400 transition-transform duration-200',
                          !openSections.has(section.key) && 'rotate-180'
                        )}
                      />
                    )}
                  </button>

                  {/* Section Items */}
                  <div
                    className={cn(
                      'overflow-hidden transition-all duration-300 ease-in-out',
                      section.children.length === 1 || openSections.has(section.key)
                        ? 'max-h-96 opacity-100 mt-1'
                        : 'max-h-0 opacity-0'
                    )}
                  >
                    <div className="space-y-1">
                      {section.children.map((item) => {
                        const active = isActive(item.path);
                        return (
                          <button
                            key={item.key}
                            onClick={() => {
                              if (item.path) {
                                router.push(item.path);
                                setMobileNavOpen(false);
                              }
                            }}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                              active
                                ? 'bg-[#EDF0FF] text-[#4880FF] font-bold'
                                : 'text-gray-700 font-medium hover:bg-gray-50'
                            )}
                          >
                            {item.icon && (
                              <span className={cn(
                                'transition-colors duration-200',
                                active ? 'text-[#4880FF]' : 'text-[#809FB8]'
                              )}>
                                {item.icon}
                              </span>
                            )}
                            <span className="text-sm">{item.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
