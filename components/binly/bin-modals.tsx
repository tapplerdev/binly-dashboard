'use client';

import { useState } from 'react';
import { BinWithPriority } from '@/lib/types/bin';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Calendar, Trash2, Loader2, MapPin } from 'lucide-react';

// Schedule Move Modal
interface ScheduleMoveModalProps {
  bin?: BinWithPriority;
  bins?: BinWithPriority[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function ScheduleMoveModal({ bin, bins, onClose, onSuccess }: ScheduleMoveModalProps) {
  const isBulk = bins && bins.length > 0;
  const targetBins = isBulk ? bins : bin ? [bin] : [];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [formData, setFormData] = useState({
    urgency: 'scheduled' as 'urgent' | 'scheduled',
    scheduled_date: new Date().toISOString().split('T')[0],
    move_type: 'pickup_only' as 'pickup_only' | 'relocation',
    disposal_action: 'retire' as 'retire' | 'store',
    new_street: '',
    new_city: '',
    new_zip: '',
    new_latitude: '',
    new_longitude: '',
    reason: '',
    notes: '',
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

    // TODO: Implement API call to schedule move
    alert('Schedule move API not yet connected - coming in next phase!');

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
          className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4 pointer-events-auto ${isClosing ? 'animate-scale-out' : 'animate-scale-in'}`}
          onClick={(e) => e.stopPropagation()}
        >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {isBulk ? 'Schedule Bulk Moves' : 'Schedule Bin Move'}
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

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Urgency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Urgency *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, urgency: 'urgent' })}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    formData.urgency === 'urgent'
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900">Urgent</div>
                  <div className="text-sm text-gray-600">Needs immediate attention</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, urgency: 'scheduled' })}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    formData.urgency === 'scheduled'
                      ? 'border-primary bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900">Scheduled</div>
                  <div className="text-sm text-gray-600">Plan for specific date</div>
                </button>
              </div>
            </div>

            {/* Scheduled Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scheduled Date *
              </label>
              <input
                type="date"
                required
                value={formData.scheduled_date}
                onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
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
