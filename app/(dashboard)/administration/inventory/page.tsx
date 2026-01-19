'use client';

import { useState } from 'react';
import { PotentialLocationsList } from '@/components/binly/potential-locations-list';
import { CreatePotentialLocationDialog } from '@/components/binly/create-potential-location-dialog';

// Import the full bins page component
import BinsPage from '../bins/page';

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'bins' | 'potential'>('bins');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Tab Navigation - Fixed at top */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex gap-3">
            <button
              onClick={() => setActiveTab('bins')}
              className={`px-8 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'bins'
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Active Bins
            </button>
            <button
              onClick={() => setActiveTab('potential')}
              className={`px-8 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'potential'
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Potential Locations
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'bins' && <BinsPage />}

      {activeTab === 'potential' && (
        <div className="p-6">
          <div className="max-w-[1600px] mx-auto">
            <PotentialLocationsList onCreateNew={() => setShowCreateDialog(true)} />
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
