'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BinWithPriority } from '@/lib/types/bin';
import { getBinsWithPriority } from '@/lib/api/bins';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Calendar, Trash2, Loader2, MapPin, Search, AlertTriangle } from 'lucide-react';
import { createMoveRequest } from '@/lib/api/move-requests';
import { cn } from '@/lib/utils';

// Schedule Move Modal
interface ScheduleMoveModalProps {
  bin?: BinWithPriority;
  bins?: BinWithPriority[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function ScheduleMoveModal({ bin, bins, onClose, onSuccess }: ScheduleMoveModalProps) {
  const isBulk = bins && bins.length > 0;
  const isStandalone = !bin && !bins; // No bin provided - show bin selector

  // Support both single bin mode and multi-select standalone mode
  const [selectedBins, setSelectedBins] = useState<BinWithPriority[]>(
    bin ? [bin] : bins || []
  );
  const [binSearchQuery, setBinSearchQuery] = useState('');
  const [showBinDropdown, setShowBinDropdown] = useState(false);

  const targetBins = selectedBins;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [dateOption, setDateOption] = useState<'24h' | '3days' | 'week' | 'custom'>('custom');
  const [formData, setFormData] = useState({
    scheduled_date: new Date().toISOString().split('T')[0],
    move_type: 'pickup_only' as 'pickup_only' | 'relocation',
    disposal_action: 'retire' as 'retire' | 'store',
    new_street: '',
    new_city: '',
    new_zip: '',
    reason: '',
    notes: '',
  });

  // Fetch all active bins for standalone mode
  const { data: allBins, isLoading: binsLoading } = useQuery({
    queryKey: ['bins', 'active'],
    queryFn: () => getBinsWithPriority({ status: 'active', limit: 1000 }),
    enabled: isStandalone,
  });

  // Filter bins for dropdown
  const availableBins = allBins?.filter((b) => {
    // Exclude bins that already have pending move requests
    if (b.has_pending_move) return false;

    // Exclude bins that are already selected
    if (selectedBins.some((selected) => selected.id === b.id)) return false;

    // Search filter
    if (binSearchQuery) {
      const query = binSearchQuery.toLowerCase();
      return (
        b.bin_number.toString().includes(query) ||
        b.current_street.toLowerCase().includes(query) ||
        b.city.toLowerCase().includes(query) ||
        b.zip.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Calculate date based on quick selection
  const handleDateQuickSelect = (option: '24h' | '3days' | 'week' | 'custom') => {
    setDateOption(option);
    const now = new Date();
    let targetDate = new Date();

    if (option === '24h') {
      targetDate.setDate(now.getDate() + 1);
    } else if (option === '3days') {
      targetDate.setDate(now.getDate() + 3);
    } else if (option === 'week') {
      targetDate.setDate(now.getDate() + 7);
    }

    if (option !== 'custom') {
      setFormData({ ...formData, scheduled_date: targetDate.toISOString().split('T')[0] });
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate bin selection in standalone mode
    if (isStandalone && selectedBins.length === 0) {
      alert('Please select at least one bin to schedule a move request.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert date string to Unix timestamp
      const scheduledDate = Math.floor(new Date(formData.scheduled_date).getTime() / 1000);

      // Create move requests for each target bin
      for (const targetBin of targetBins) {
        await createMoveRequest({
          bin_id: targetBin.id,
          scheduled_date: scheduledDate,
          move_type: formData.move_type,
          disposal_action: formData.move_type === 'pickup_only' ? formData.disposal_action : undefined,
          new_street: formData.move_type === 'relocation' ? formData.new_street : undefined,
          new_city: formData.move_type === 'relocation' ? formData.new_city : undefined,
          new_zip: formData.move_type === 'relocation' ? formData.new_zip : undefined,
          reason: formData.reason || undefined,
          notes: formData.notes || undefined,
        });
      }

      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error('Failed to create move request:', error);
      alert('Failed to schedule move. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[60] bg-black/50 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none">
        <Card
          className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4 pointer-events-auto ${isClosing ? 'animate-scale-out' : 'animate-scale-in'}`}
          onClick={(e) => e.stopPropagation()}
        >
        <div className="p-6 relative">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedBins.length > 1 ? 'Schedule Bulk Moves' : 'Schedule Bin Move'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {selectedBins.length > 1
                  ? `${selectedBins.length} bins selected`
                  : selectedBins.length === 1
                  ? `Bin ${selectedBins[0].bin_number} - ${selectedBins[0].current_street}`
                  : 'Select bin(s) to schedule move request(s)'}
              </p>
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Bin Selector (Standalone Mode Only) */}
          {isStandalone && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Bin *
              </label>

              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by bin #, street, city, or zip..."
                  value={binSearchQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    setBinSearchQuery(value);
                    // Only show dropdown when there's input
                    if (value.length > 0) {
                      setShowBinDropdown(true);
                    } else {
                      setShowBinDropdown(false);
                    }
                  }}
                  onClick={() => {
                    // Show dropdown on click only if there's already text
                    if (binSearchQuery.length > 0) {
                      setShowBinDropdown(true);
                    }
                  }}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
              </div>

              {/* Selected Bins Display (Multi-select badges) */}
              {selectedBins.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedBins.map((selectedBin) => (
                    <div
                      key={selectedBin.id}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 border-2 border-blue-200 rounded-xl"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-900">Bin #{selectedBin.bin_number}</span>
                        {selectedBin.fill_percentage !== null && (
                          <span className={cn(
                            'text-xs px-1.5 py-0.5 rounded-full font-medium',
                            selectedBin.fill_percentage >= 80 ? 'bg-red-100 text-red-700' :
                            selectedBin.fill_percentage >= 50 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          )}>
                            {selectedBin.fill_percentage}%
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBins(selectedBins.filter((b) => b.id !== selectedBin.id));
                        }}
                        className="p-0.5 hover:bg-blue-200 rounded transition-colors"
                      >
                        <X className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Dropdown Results */}
              {showBinDropdown && (
                <>
                  {/* Click outside to close dropdown - positioned BEHIND dropdown */}
                  <div
                    className="fixed inset-0 z-[5]"
                    onClick={() => setShowBinDropdown(false)}
                  />

                  {/* Dropdown with animation and higher z-index */}
                  <div className="relative z-[10] mt-2 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl animate-slide-in-down">
                    {binsLoading ? (
                      <div className="p-4 text-center text-gray-500">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Loading bins...
                      </div>
                    ) : availableBins && availableBins.length > 0 ? (
                      <div className="py-2">
                        {availableBins.slice(0, 50).map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Add bin to selection
                              setSelectedBins([...selectedBins, b]);
                              // Clear search and close dropdown
                              setBinSearchQuery('');
                              setShowBinDropdown(false);
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 transition-all duration-150 border-b border-gray-100 last:border-b-0 cursor-pointer"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-gray-900">Bin #{b.bin_number}</span>
                                  {b.fill_percentage !== null && (
                                    <span className={cn(
                                      'text-xs px-2 py-0.5 rounded-full font-medium',
                                      b.fill_percentage >= 80 ? 'bg-red-100 text-red-700' :
                                      b.fill_percentage >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-green-100 text-green-700'
                                    )}>
                                      {b.fill_percentage}%
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-600">{b.current_street}</div>
                                <div className="text-xs text-gray-500">{b.city}, {b.zip}</div>
                              </div>
                            </div>
                          </button>
                        ))}
                        {availableBins.length > 50 && (
                          <div className="px-4 py-2 text-xs text-gray-500 text-center bg-gray-50">
                            Showing first 50 results. Refine your search to see more.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-gray-500">
                        <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">No available bins found</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {binSearchQuery ? 'Try a different search' : 'All bins may already have pending move requests'}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* When to Move */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                When should this be moved? *
              </label>

              {/* Quick Date Buttons */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => handleDateQuickSelect('24h')}
                  className={`px-3 py-2 text-sm border-2 rounded-lg transition-colors ${
                    dateOption === '24h'
                      ? 'border-red-500 bg-red-50 text-red-700 font-semibold'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  Within 24hrs
                </button>
                <button
                  type="button"
                  onClick={() => handleDateQuickSelect('3days')}
                  className={`px-3 py-2 text-sm border-2 rounded-lg transition-colors ${
                    dateOption === '3days'
                      ? 'border-orange-500 bg-orange-50 text-orange-700 font-semibold'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  Within 3 days
                </button>
                <button
                  type="button"
                  onClick={() => handleDateQuickSelect('week')}
                  className={`px-3 py-2 text-sm border-2 rounded-lg transition-colors ${
                    dateOption === 'week'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  Next week
                </button>
                <button
                  type="button"
                  onClick={() => handleDateQuickSelect('custom')}
                  className={`px-3 py-2 text-sm border-2 rounded-lg transition-colors ${
                    dateOption === 'custom'
                      ? 'border-primary bg-blue-50 text-blue-700 font-semibold'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  Custom date
                </button>
              </div>

              {/* Date Picker (always visible) */}
              <input
                type="date"
                required
                value={formData.scheduled_date}
                onChange={(e) => {
                  setFormData({ ...formData, scheduled_date: e.target.value });
                  setDateOption('custom');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Move Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Move Type *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, move_type: 'pickup_only' })}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    formData.move_type === 'pickup_only'
                      ? 'border-primary bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900">Pickup Only</div>
                  <div className="text-sm text-gray-600">Remove without relocation</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, move_type: 'relocation' })}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    formData.move_type === 'relocation'
                      ? 'border-primary bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900">Relocation</div>
                  <div className="text-sm text-gray-600">Move to new address</div>
                </button>
              </div>
            </div>

            {/* Disposal Action (for pickup_only) */}
            {formData.move_type === 'pickup_only' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  After Pickup *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, disposal_action: 'retire' })}
                    className={`p-3 border-2 rounded-lg text-center transition-colors ${
                      formData.disposal_action === 'retire'
                        ? 'border-primary bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold text-gray-900">Retire</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, disposal_action: 'store' })}
                    className={`p-3 border-2 rounded-lg text-center transition-colors ${
                      formData.disposal_action === 'store'
                        ? 'border-primary bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold text-gray-900">Store</div>
                  </button>
                </div>
              </div>
            )}

            {/* New Location (for relocation) */}
            {formData.move_type === 'relocation' && (
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  New Location
                </h4>
                <input
                  type="text"
                  required={formData.move_type === 'relocation'}
                  value={formData.new_street}
                  onChange={(e) => setFormData({ ...formData, new_street: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Street Address"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    required={formData.move_type === 'relocation'}
                    value={formData.new_city}
                    onChange={(e) => setFormData({ ...formData, new_city: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="City"
                  />
                  <input
                    type="text"
                    required={formData.move_type === 'relocation'}
                    value={formData.new_zip}
                    onChange={(e) => setFormData({ ...formData, new_zip: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="ZIP"
                  />
                </div>
              </div>
            )}

            {/* Reason & Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason
              </label>
              <input
                type="text"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Why is this move needed?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
                placeholder="Additional details..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary hover:bg-primary/90"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scheduling...</>
                ) : (
                  <><Calendar className="w-4 h-4 mr-2" />Schedule Move</>
                )}
              </Button>
            </div>
          </form>
        </div>
      </Card>
      </div>
    </>
  );
}

// Retire Bin Modal
interface RetireBinModalProps {
  bin?: BinWithPriority;
  bins?: BinWithPriority[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function RetireBinModal({ bin, bins, onClose, onSuccess }: RetireBinModalProps) {
  const isBulk = bins && bins.length > 0;
  const targetBins = isBulk ? bins : bin ? [bin] : [];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [formData, setFormData] = useState({
    disposal_action: 'retire' as 'retire' | 'store',
    reason: '',
  });

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // TODO: Implement API call to retire bin
    alert('Retire bin API not yet connected - coming in next phase!');

    setTimeout(() => {
      setIsSubmitting(false);
      onSuccess?.();
      handleClose();
    }, 1000);
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <Card
          className={`w-full max-w-md m-4 pointer-events-auto ${isClosing ? 'animate-scale-out' : 'animate-scale-in'}`}
          onClick={(e) => e.stopPropagation()}
        >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {isBulk ? 'Retire Multiple Bins' : 'Retire Bin'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {isBulk
                  ? `${targetBins.length} bins selected`
                  : bin
                  ? `Bin ${bin.bin_number} - ${bin.current_street}`
                  : ''}
              </p>
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Warning */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                {isBulk
                  ? `These ${targetBins.length} bins will be removed from active service. You can still view them in the system.`
                  : 'This bin will be removed from active service. You can still view it in the system.'}
              </p>
            </div>

            {/* Disposal Action */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Action *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, disposal_action: 'retire' })}
                  className={`p-4 border-2 rounded-lg text-center transition-colors ${
                    formData.disposal_action === 'retire'
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900">Retire</div>
                  <div className="text-xs text-gray-600">Permanently remove</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, disposal_action: 'store' })}
                  className={`p-4 border-2 rounded-lg text-center transition-colors ${
                    formData.disposal_action === 'store'
                      ? 'border-primary bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900">Store</div>
                  <div className="text-xs text-gray-600">Keep in warehouse</div>
                </button>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason *
              </label>
              <textarea
                required
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                rows={3}
                placeholder="Why is this bin being retired?"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Retiring...</>
                ) : (
                  <><Trash2 className="w-4 h-4 mr-2" />Retire Bin</>
                )}
              </Button>
            </div>
          </form>
        </div>
      </Card>
      </div>
    </>
  );
}
