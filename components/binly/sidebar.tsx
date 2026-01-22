'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { sidebarNavItems, NavItem } from './sidebar-nav-items';
import { ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Find which section contains the current path on initial mount only
  const defaultOpenSection = sidebarNavItems.find((section) =>
    section.children.some((item) => item.path === pathname)
  );

  // State for manually toggled sections (accordion behavior - only one open at a time)
  const [openSection, setOpenSection] = useState<string | null>(
    defaultOpenSection?.key ?? null
  );

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
        'hidden lg:flex relative bg-white border-r border-gray-200 h-screen transition-all duration-300 ease-in-out flex-col',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Logo Section - Fixed height to match top nav bar */}
      <div className={cn('h-16 flex items-center px-6 shrink-0', collapsed ? 'justify-center px-0' : '')}>
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

      {/* Navigation - Scrollable */}
      <div className="p-6 flex-1 overflow-y-auto">
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

    </aside>
  );
}
