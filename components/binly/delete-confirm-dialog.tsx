'use client';

import { useState } from 'react';
import { Trash2, X, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PotentialLocation {
  id: string;
  address: string;
  street: string;
  city: string;
  zip: string;
}

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: PotentialLocation | null;
  onSuccess: () => void;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  location,
  onSuccess,
}: DeleteConfirmDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    if (!location) return;

    setError('');
    setLoading(true);

    try {
      // Get auth token from Zustand persist storage
      const authStorage = localStorage.getItem('binly-auth-storage');
      const token = authStorage ? JSON.parse(authStorage)?.state?.token : null;
      if (!token) {
        setError('You must be logged in to delete locations');
        setLoading(false);
        return;
      }

      const response = await fetch(
        `https://ropacal-backend-production.up.railway.app/api/potential-locations/${location.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Failed to delete location');
      }

      // Success
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!open || !location) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-fade-in"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl z-50 animate-scale-in">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Delete Location</h2>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Location Info */}
          <div className="p-4 bg-red-50 rounded-xl">
            <p className="text-xs font-semibold text-red-900 uppercase tracking-wide mb-2">
              Location to Delete
            </p>
            <p className="font-semibold text-red-900 mb-1">{location.street}</p>
            <p className="text-sm text-red-700">
              {location.city}, {location.zip}
            </p>
          </div>

          {/* Warning */}
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-900 mb-1">
                  Permanent Deletion
                </p>
                <p className="text-xs text-yellow-700">
                  This potential location will be permanently removed from the system.
                  This action cannot be undone.
                </p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              className="flex-1 gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete Location
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
