'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Settings, Bell, Building2, LogOut, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth/store';

export function ProfilePill() {
  const router = useRouter();
  const { clearAuth } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Pill - Compact */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-[#5E9646] text-white rounded-full shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
      >
        {/* Avatar Icon */}
        <User className="w-5 h-5" />

        {/* Show first name */}
        <span className="font-semibold text-sm">Omar</span>

        {/* Chevron */}
        <ChevronDown
          className={cn(
            'w-4 h-4 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-scale-in z-50">
          {/* Header with full details - shown only when expanded */}
          <div className="px-6 py-4 bg-[#5E9646]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
                O
              </div>
              <div className="flex-1">
                <p className="font-semibold text-white text-base">Omar Gabr</p>
                <p className="text-xs text-white/80 mt-0.5">admin@binly.com</p>
              </div>
            </div>
            <span className="inline-block px-2.5 py-1 bg-white/20 text-white text-xs font-bold rounded uppercase">
              Owner
            </span>
          </div>

          <div className="py-2">
            <MenuItem
              icon={<User className="w-4 h-4" />}
              label="Profile Settings"
              onClick={() => {
                console.log('Profile Settings clicked');
                setIsOpen(false);
              }}
            />
            <MenuItem
              icon={<Building2 className="w-4 h-4" />}
              label="Organization"
              onClick={() => {
                console.log('Organization clicked');
                setIsOpen(false);
              }}
            />
            <MenuItem
              icon={<Bell className="w-4 h-4" />}
              label="Notifications"
              onClick={() => {
                console.log('Notifications clicked');
                setIsOpen(false);
              }}
            />
          </div>

          <div className="border-t border-gray-100 py-2">
            <MenuItem
              icon={<Settings className="w-4 h-4" />}
              label="System Status"
              onClick={() => {
                console.log('System Status clicked');
                setIsOpen(false);
              }}
            />
          </div>

          <div className="border-t border-gray-100 py-2">
            <MenuItem
              icon={<LogOut className="w-4 h-4" />}
              label="Logout"
              onClick={handleLogout}
              variant="danger"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  variant = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors duration-150',
        variant === 'default'
          ? 'text-gray-700 hover:bg-[#EDF0FF] hover:text-[#4880FF]'
          : 'text-red-600 hover:bg-red-50'
      )}
    >
      <span
        className={cn(
          variant === 'default' ? 'text-gray-400' : 'text-red-500'
        )}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}
