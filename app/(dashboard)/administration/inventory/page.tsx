'use client';

import { useState } from 'react';
import { PotentialLocationsList } from '@/components/binly/potential-locations-list';
import { CreatePotentialLocationDialog } from '@/components/binly/create-potential-location-dialog';
import { MoveRequestsList } from '@/components/binly/move-requests-list';

// Import the full bins page component
import BinsPage from '../bins/page';

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'bins' | 'potential' | 'moves'>('bins');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Tab Navigation - Fixed at top */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-3 lg:px-6">
          <div className="flex gap-4 lg:gap-8 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab('bins')}
              className={`py-3 text-xs lg:text-sm font-medium transition-all duration-200 relative whitespace-nowrap ${
                activeTab === 'bins'
                  ? 'text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Active Bins
              <div className={`absolute -bottom-[1px] left-0 right-0 h-[2px] bg-primary transition-all duration-200 ${
                activeTab === 'bins' ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'
              }`} />
            </button>
            <button
              onClick={() => setActiveTab('potential')}
              className={`py-3 text-xs lg:text-sm font-medium transition-all duration-200 relative whitespace-nowrap ${
                activeTab === 'potential'
                  ? 'text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Potential Locations
              <div className={`absolute -bottom-[1px] left-0 right-0 h-[2px] bg-primary transition-all duration-200 ${
                activeTab === 'potential' ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'
              }`} />
            </button>
            <button
              onClick={() => setActiveTab('moves')}
              className={`py-3 text-xs lg:text-sm font-medium transition-all duration-200 relative whitespace-nowrap ${
                activeTab === 'moves'
                  ? 'text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Move Requests
              <div className={`absolute -bottom-[1px] left-0 right-0 h-[2px] bg-primary transition-all duration-200 ${
                activeTab === 'moves' ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'bins' && <BinsPage />}

      {activeTab === 'potential' && (
        <div className="p-3 lg:p-6">
          <div className="max-w-[1600px] mx-auto">
            <PotentialLocationsList onCreateNew={() => setShowCreateDialog(true)} />
          </div>
        </div>
      )}

      {activeTab === 'moves' && (
        <div className="p-3 lg:p-6">
          <div className="max-w-[1600px] mx-auto">
            <MoveRequestsList />
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <CreatePotentialLocationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
}
