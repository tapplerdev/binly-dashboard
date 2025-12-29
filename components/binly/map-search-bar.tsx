'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Bin } from '@/lib/types/bin';
import { NoGoZone } from '@/lib/types/zone';

interface SearchResult {
  id: string;
  type: 'bin' | 'zone';
  label: string;
  sublabel: string;
  data: Bin | NoGoZone;
}

interface MapSearchBarProps {
  bins: Bin[];
  zones: NoGoZone[];
  onSelectResult: (result: SearchResult) => void;
}

export function MapSearchBar({ bins, zones, onSelectResult }: MapSearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search logic with smart ranking
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const searchQuery = query.toLowerCase().trim();
    const matchedResults: Array<SearchResult & { score: number }> = [];

    // Search bins
    bins.forEach((bin) => {
      const binNumber = bin.bin_number.toString();
      const address = `${bin.current_street}, ${bin.city}`.toLowerCase();
      const zip = bin.zip;

      let score = 0;

      // Exact bin number match (highest priority)
      if (binNumber === searchQuery) {
        score = 100;
      }
      // Bin number starts with query (high priority)
      else if (binNumber.startsWith(searchQuery)) {
        score = 90;
      }
      // Bin number contains query (medium priority)
      else if (binNumber.includes(searchQuery)) {
        score = 50;
      }
      // Address starts with query
      else if (address.startsWith(searchQuery)) {
        score = 70;
      }
      // Address or ZIP contains query
      else if (address.includes(searchQuery) || zip.includes(searchQuery)) {
        score = 30;
      }

      if (score > 0) {
        matchedResults.push({
          id: bin.id,
          type: 'bin',
          label: `Bin #${bin.bin_number}`,
          sublabel: `${bin.current_street}, ${bin.city} ${bin.zip}`,
          data: bin,
          score,
        });
      }
    });

    // Search zones
    zones.forEach((zone) => {
      const zoneName = zone.name.toLowerCase();
      const zoneStatus = zone.status.toLowerCase();

      let score = 0;

      if (zoneName === searchQuery) {
        score = 100;
      } else if (zoneName.startsWith(searchQuery)) {
        score = 80;
      } else if (zoneName.includes(searchQuery) || zoneStatus.includes(searchQuery)) {
        score = 40;
      }

      if (score > 0) {
        matchedResults.push({
          id: zone.id,
          type: 'zone',
          label: zone.name,
          sublabel: `Zone • Score: ${zone.conflict_score}`,
          data: zone,
          score,
        });
      }
    });

    // Sort by score (highest first), then limit to top 5
    const sortedResults = matchedResults
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ score, ...rest }) => rest); // Remove score from final results

    setResults(sortedResults);
    setIsOpen(sortedResults.length > 0);
    setSelectedIndex(0);
  }, [query, bins, zones]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelectResult(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle result selection
  const handleSelectResult = (result: SearchResult) => {
    onSelectResult(result);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full max-w-md">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query && setIsOpen(results.length > 0)}
          placeholder="Search bin #, address, or zone..."
          className="w-full pl-11 pr-10 py-3 bg-white rounded-full shadow-lg text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full mt-2 w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-fade-in"
        >
          <div className="max-h-80 overflow-y-auto">
            {results.map((result, index) => (
              <button
                key={result.id}
                onClick={() => handleSelectResult(result)}
                className={`w-full px-4 py-3 text-left transition-colors ${
                  index === selectedIndex
                    ? 'bg-primary/5'
                    : 'hover:bg-gray-50'
                } ${index > 0 ? 'border-t border-gray-100' : ''}`}
              >
                <div className="flex items-center gap-3">
                  {/* Type indicator */}
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      result.type === 'bin' ? 'bg-primary' : 'bg-red-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {result.label}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {result.sublabel}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
