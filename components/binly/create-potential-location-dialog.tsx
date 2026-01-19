'use client';

import { useState } from 'react';
import { MapPin, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { inputStyles } from '@/lib/utils';

interface CreatePotentialLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePotentialLocationDialog({
  open,
  onOpenChange,
}: CreatePotentialLocationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    street: '',
    city: '',
    zip: '',
    latitude: '',
    longitude: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Get auth token from localStorage
      const token = localStorage.getItem('authToken');
      if (!token) {
        setError('You must be logged in to create a potential location');
        setLoading(false);
        return;
      }

      const payload: any = {
        street: formData.street,
        city: formData.city,
        zip: formData.zip,
      };

      // Add optional fields if provided
      if (formData.latitude) {
        payload.latitude = parseFloat(formData.latitude);
      }
      if (formData.longitude) {
        payload.longitude = parseFloat(formData.longitude);
      }
      if (formData.notes) {
        payload.notes = formData.notes;
      }

      const response = await fetch(
        'https://ropacal-backend-production.up.railway.app/api/potential-locations',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Failed to create potential location');
      }

      // Success - reset form and close dialog
      setFormData({
        street: '',
        city: '',
        zip: '',
        latitude: '',
        longitude: '',
        notes: '',
      });
      onOpenChange(false);

      // Trigger a refresh by emitting a custom event
      window.dispatchEvent(new CustomEvent('potential-location-created'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-fade-in"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-2xl shadow-2xl z-50 animate-scale-in">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">New Potential Location</h2>
                <p className="text-sm text-gray-600">Add a location for future bin placement</p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Street */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Street Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.street}
              onChange={(e) => setFormData({ ...formData, street: e.target.value })}
              placeholder="123 Main St"
              className={inputStyles()}
            />
          </div>

          {/* City and Zip */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                City <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Dallas"
                className={inputStyles()}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                ZIP Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.zip}
                onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                placeholder="75201"
                className={inputStyles()}
              />
            </div>
          </div>

          {/* Coordinates (Optional) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Latitude <span className="text-gray-400 text-xs">(Optional)</span>
              </label>
              <input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                placeholder="32.776665"
                className={inputStyles()}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Longitude <span className="text-gray-400 text-xs">(Optional)</span>
              </label>
              <input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                placeholder="-96.796989"
                className={inputStyles()}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Notes <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional information about this location..."
              rows={3}
              className={inputStyles()}
            />
          </div>

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
              type="submit"
              className="flex-1 gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4" />
                  Create Location
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
