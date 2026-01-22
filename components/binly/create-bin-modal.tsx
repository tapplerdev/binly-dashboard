'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createBin } from '@/lib/api/bins';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, MapPin, Package, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateBinModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateBinModal({ onClose, onSuccess }: CreateBinModalProps) {
  const queryClient = useQueryClient();
  const [isClosing, setIsClosing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState({
    current_street: '',
    city: '',
    zip: '',
    fill_percentage: 0,
    latitude: '',
    longitude: '',
  });

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const createMutation = useMutation({
    mutationFn: createBin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bins'] });
      onSuccess?.();
      handleClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    createMutation.mutate({
      current_street: formData.current_street,
      city: formData.city,
      zip: formData.zip,
      status: 'active',
      fill_percentage: formData.fill_percentage || undefined,
      latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
      longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
    });
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <Card
          className={`w-full max-w-lg max-h-[90vh] overflow-y-auto m-4 pointer-events-auto rounded-2xl ${isClosing ? 'animate-scale-out' : 'animate-scale-in'}`}
          onClick={(e) => e.stopPropagation()}
        >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">New Bin</h2>
              <p className="text-sm text-gray-500 mt-1">
                Bin number will be auto-assigned
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Street Address *
              </label>
              <input
                type="text"
                required
                value={formData.current_street}
                onChange={(e) => setFormData({ ...formData, current_street: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:bg-white transition-colors"
                placeholder="123 Main Street"
              />
            </div>

            {/* City & ZIP */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City *
                </label>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:bg-white transition-colors"
                  placeholder="Portland"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ZIP Code *
                </label>
                <input
                  type="text"
                  required
                  value={formData.zip}
                  onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:bg-white transition-colors"
                  placeholder="97201"
                />
              </div>
            </div>

            {/* Fill Percentage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Initial Fill Percentage
              </label>
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  {/* Gradient Track */}
                  <div className="absolute inset-0 h-2 rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 pointer-events-none" />

                  {/* Slider */}
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.fill_percentage}
                    onChange={(e) => setFormData({ ...formData, fill_percentage: parseInt(e.target.value) })}
                    className="relative w-full h-2 bg-transparent appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-5
                      [&::-webkit-slider-thumb]:h-5
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-white
                      [&::-webkit-slider-thumb]:border-2
                      [&::-webkit-slider-thumb]:border-gray-400
                      [&::-webkit-slider-thumb]:shadow-md
                      [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-webkit-slider-thumb]:hover:border-gray-500
                      [&::-webkit-slider-thumb]:transition-colors
                      [&::-moz-range-thumb]:w-5
                      [&::-moz-range-thumb]:h-5
                      [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-white
                      [&::-moz-range-thumb]:border-2
                      [&::-moz-range-thumb]:border-gray-400
                      [&::-moz-range-thumb]:shadow-md
                      [&::-moz-range-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:hover:border-gray-500
                      [&::-moz-range-thumb]:transition-colors"
                  />
                </div>
                <div className={cn(
                  "w-20 text-center px-3 py-2 rounded-lg font-semibold text-lg transition-colors",
                  formData.fill_percentage >= 86 ? "bg-red-50 text-red-700" :
                  formData.fill_percentage >= 51 ? "bg-yellow-50 text-yellow-700" :
                  "bg-green-50 text-green-700"
                )}>
                  {formData.fill_percentage}%
                </div>
              </div>
            </div>

            {/* Advanced Options Toggle */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {showAdvanced ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Hide Advanced Options
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Show Advanced Options
                  </>
                )}
              </button>
            </div>

            {/* Coordinates (Collapsible) */}
            {showAdvanced && (
              <div className="animate-slide-in-down">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Precise Coordinates
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:bg-white transition-colors"
                    placeholder="Latitude"
                  />
                  <input
                    type="text"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:bg-white transition-colors"
                    placeholder="Longitude"
                  />
                </div>
              </div>
            )}

            {/* Error Message */}
            {createMutation.isError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">
                  {createMutation.error instanceof Error
                    ? createMutation.error.message
                    : 'Failed to create bin'}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary hover:bg-primary/90"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4 mr-2" />
                    Create Bin
                  </>
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
