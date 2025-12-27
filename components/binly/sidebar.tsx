'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { sidebarNavItems, NavItem } from './sidebar-nav-items';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Settings, LogOut, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth/store';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { clearAuth } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Find which section contains the current path on initial mount only
  const defaultOpenSection = sidebarNavItems.find((section) =>
    section.children.some((item) => item.path === pathname)
  );

  // State for manually toggled sections (accordion behavior - only one open at a time)
  const [openSection, setOpenSection] = useState<string | null>(
    defaultOpenSection?.key ?? null
  );

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

  const toggleSection = (key: string) => {
    // Toggle: if clicking the open section, close it; otherwise open the new one
    setOpenSection((prev) => (prev === key ? null : key));
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    return pathname === path;
  };

  return (
    <aside
      className={cn(
        'relative bg-white border-r border-gray-200 h-screen transition-all duration-300 ease-in-out',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      <div className="p-6 pb-16 h-full overflow-y-auto">
        {/* Logo */}
        <div className={cn('mb-6 flex items-center', collapsed ? 'justify-center' : '')}>
          {!collapsed ? (
            <h1
              className="text-2xl font-bold leading-none transition-opacity duration-300"
              style={{
                background: 'linear-gradient(to right, #5E9646, #4AA0B5)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              BINLY
            </h1>
          ) : (
            <h1
              className="text-xl font-bold leading-none transition-opacity duration-300"
              style={{
                background: 'linear-gradient(to right, #5E9646, #4AA0B5)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              B
            </h1>
          )}
        </div>

        {/* Navigation */}
        <nav className="space-y-6">
          {sidebarNavItems.map((section) => (
            <div key={section.key}>
              {/* Section Header */}
              {!collapsed && (
                <div
                  className={cn(
                    'flex items-center justify-between mb-2 cursor-pointer select-none transition-colors duration-200',
                    section.children.length > 1 && 'hover:text-[#4880FF]'
                  )}
                  onClick={() =>
                    section.children.length > 1 && toggleSection(section.key)
                  }
                >
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider transition-colors duration-200">
                    {section.title}
                  </h3>
                  {section.children.length > 1 && (
                    <ChevronUp
                      className={cn(
                        'w-4 h-4 text-gray-400 transition-transform duration-200',
                        openSection === section.key && 'rotate-180'
                      )}
                    />
                  )}
                </div>
              )}

              {/* Section Items */}
              <div
                className={cn(
                  'overflow-hidden transition-all duration-300 ease-in-out',
                  section.children.length === 1 || openSection === section.key
                    ? 'max-h-96 opacity-100'
                    : 'max-h-0 opacity-0'
                )}
              >
                <ul className="space-y-1">
                  {section.children.map((item) => (
                    <li key={item.key}>
                      <Link
                        href={item.path || '#'}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200',
                          collapsed && 'justify-center',
                          isActive(item.path)
                            ? 'bg-[#EDF0FF] text-[#4880FF] font-bold'
                            : 'text-[#809FB8] font-medium hover:bg-[#EDF0FF]'
                        )}
                        title={collapsed ? item.title : undefined}
                      >
                        {item.icon && (
                          <span
                            className={cn(
                              'transition-colors duration-200',
                              isActive(item.path)
                                ? 'text-[#4880FF]'
                                : 'text-[#809FB8]'
                            )}
                          >
                            {item.icon}
                          </span>
                        )}
                        {!collapsed && <span className="text-base transition-all duration-200">{item.title}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Profile Section - Bottom of Sidebar */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200" ref={profileRef}>
        {/* Dropdown Menu - Opens Above Profile */}
        {profileOpen && !collapsed && (
          <div className="absolute bottom-full left-0 right-0 mb-1 mx-2 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden animate-scale-in">
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

        {/* Profile Button */}
        <button
          onClick={() => !collapsed && setProfileOpen(!profileOpen)}
          className={cn(
            "w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors duration-200",
            collapsed && "justify-center"
          )}
        >
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5E9646] to-[#4AA0B5] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            O
          </div>

          {/* User Info - Hidden when collapsed */}
          {!collapsed && (
            <div className="flex-1 text-left overflow-hidden">
              <p className="text-sm font-semibold text-gray-900 truncate">Omar Gabr</p>
              <p className="text-xs text-gray-500 truncate">admin@binly.com</p>
            </div>
          )}

          {/* Expand Icon - Hidden when collapsed */}
          {!collapsed && (
            <ChevronUp
              className={cn(
                'w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0',
                profileOpen && 'rotate-180'
              )}
            />
          )}
        </button>
      </div>
    </aside>
  );
}
