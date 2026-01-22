'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, Map, Package, Brain, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomNavItem {
  key: string;
  title: string;
  icon: React.ReactNode;
  path: string;
}

const bottomNavItems: BottomNavItem[] = [
  {
    key: 'home',
    title: 'Home',
    icon: <Home className="w-5 h-5" />,
    path: '/',
  },
  {
    key: 'operations',
    title: 'Operations',
    icon: <Map className="w-5 h-5" />,
    path: '/operations/live-map',
  },
  {
    key: 'inventory',
    title: 'Inventory',
    icon: <Package className="w-5 h-5" />,
    path: '/administration/inventory',
  },
  {
    key: 'intelligence',
    title: 'Intelligence',
    icon: <Brain className="w-5 h-5" />,
    path: '/intelligence/analytics',
  },
  {
    key: 'profile',
    title: 'Profile',
    icon: <User className="w-5 h-5" />,
    path: '/profile',
  },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16">
        {bottomNavItems.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.key}
              onClick={() => router.push(item.path)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full transition-colors',
                'active:bg-gray-100',
                active ? 'text-primary' : 'text-gray-500'
              )}
            >
              <div className={cn(
                'transition-transform',
                active && 'scale-110'
              )}>
                {item.icon}
              </div>
              <span className={cn(
                'text-xs mt-1 font-medium',
                active && 'font-semibold'
              )}>
                {item.title}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
