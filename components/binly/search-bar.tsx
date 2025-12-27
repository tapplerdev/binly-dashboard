'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  className?: string;
}

export function SearchBar({
  placeholder = 'Search Bin ID, Driver Name, or Location...',
  onSearch,
  className,
}: SearchBarProps) {
  const [query, setQuery] = useState('');

  const handleSearch = (value: string) => {
    setQuery(value);
    onSearch?.(value);
  };

  return (
    <div className={cn('relative', className)}>
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-gray-400" />
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        className="block w-full pl-11 pr-4 py-3 border border-solid border-neutral-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent transition-all bg-white"
        placeholder={placeholder}
      />
    </div>
  );
}
