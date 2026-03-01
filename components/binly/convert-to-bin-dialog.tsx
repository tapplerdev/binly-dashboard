'use client';

import { useState, useEffect } from 'react';
import { Check, X, Loader2, Package, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { inputStyles } from '@/lib/utils';
import { checkPotentialLocationDependencies, ActiveShiftDependency } from '@/lib/api/potential-locations';
import { ActiveShiftWarningDialog } from './active-shift-warning-dialog';

interface PotentialLocation {
  id: string;
  address: string;
  street: string;
  city: string;
  zip: string;
}

interface ConvertToBinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: PotentialLocation | null;
  onSuccess: () => void;
}

export function ConvertToBinDialog({
  open,
  onOpenChange,
  location,
  onSuccess,
}: ConvertToBinDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [binNumber, setBinNumber] = useState('');
  const [fillPercentage, setFillPercentage] = useState('');
  const [checkingDependencies, setCheckingDependencies] = useState(false);
  const [dependencies, setDependencies] = useState<ActiveShiftDependency[]>([]);
  const [showWarningDialog, setShowWarningDialog] = useState(false);

  // Check for dependencies when dialog opens
  useEffect(() => {
    if (!open || !location) {
      setDependencies([]);
      return;
    }

    const checkDependencies = async () => {
      setCheckingDependencies(true);
      try {
        const deps = await checkPotentialLocationDependencies(location.id);
        setDependencies(deps);
      } catch (error) {
        console.error('Failed to check potential location dependencies:', error);
        // Continue anyway if check fails
      }
      setCheckingDependencies(false);
    };

    checkDependencies();
  }, [open, location]);

  const handleWarningConfirm = () => {
    setShowWarningDialog(false);
    // Proceed with conversion after warning acknowledged
    handleConvert();
  };

  const handleConvert = async () => {
    if (!location) return;

    setError('');
    setLoading(true);

    try {
      // Get auth token from Zustand persist storage
      const authStorage = localStorage.getItem('binly-auth-storage');
      const token = authStorage ? JSON.parse(authStorage)?.state?.token : null;
      if (!token) {
        setError('You must be logged in to convert locations');
        setLoading(false);
        return;
      }

      // Build payload with optional bin_number and fill_percentage
      const payload: any = {
        fill_percentage: fillPercentage ? parseInt(fillPercentage, 10) : 0,
      };

      // Only include bin_number if provided
      if (binNumber && parseInt(binNumber, 10) > 0) {
        payload.bin_number = parseInt(binNumber, 10);
      }

      const response = await fetch(
        `https://ropacal-backend-production.up.railway.app/api/potential-locations/${location.id}/convert`,
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
        throw new Error(errorData || 'Failed to convert location');
      }

      // Success
      setBinNumber('');
      setFillPercentage('');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) return;

    // If there are dependencies, show warning dialog first
    if (dependencies.length > 0 && !showWarningDialog) {
      setShowWarningDialog(true);
      return;
    }

    // No dependencies or already confirmed - proceed with conversion
    handleConvert();
  };

  if (!open || !location) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-[60] animate-fade-in flex items-center justify-center p-4"
        onClick={() => onOpenChange(false)}
      >
        {/* Dialog */}
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md z-[70] animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Convert to Bin</h2>
                <p className="text-sm text-gray-600">Create a new bin from this location</p>
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
          {/* Location Info */}
          <div className="p-4 bg-blue-50 rounded-xl">
            <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide mb-2">
              Location to Convert
            </p>
            <p className="font-semibold text-blue-900 mb-1">{location.street}</p>
            <p className="text-sm text-blue-700">
              {location.city}, {location.zip}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Active Shift Warning */}
          {checkingDependencies ? (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-start gap-3">
                <Loader2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5 animate-spin" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">
                    Checking Active Shifts
                  </p>
                  <p className="text-xs text-blue-700">
                    Verifying if this location is being used in any active driver shifts...
                  </p>
                </div>
              </div>
            </div>
          ) : dependencies.length > 0 ? (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-orange-900 mb-1">
                    Active Shift Impact
                  </p>
                  <p className="text-xs text-orange-700">
                    This potential location is currently being used in{' '}
                    <span className="font-semibold">
                      {dependencies.length} active {dependencies.length === 1 ? 'shift' : 'shifts'}
                    </span>
                    . Converting it will remove the associated placement task(s) from the driver's route.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Bin Number (Optional) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Bin Number <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={binNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, '');
                setBinNumber(value);
              }}
              placeholder="Auto-assigned if left empty"
              className={inputStyles()}
            />
            <p className="text-xs text-gray-500 mt-2">
              Leave empty for auto-assignment
            </p>
          </div>

          {/* Fill Percentage (Optional) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Initial Fill Percentage <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                value={fillPercentage}
                onChange={(e) => setFillPercentage(e.target.value)}
                placeholder="0"
                className={inputStyles()}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-5 pointer-events-none">
                <span className="text-gray-500">%</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Leave empty for 0% fill level
            </p>
          </div>

          {/* Info Box */}
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-start gap-3">
              <Package className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">What happens next?</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• A new bin will be created at this location</li>
                  <li>• Bin number auto-assigned if not specified</li>
                  <li>• This potential location will be archived</li>
                  <li>• The bin will be marked as "active"</li>
                </ul>
              </div>
            </div>
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
              className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
              disabled={loading || checkingDependencies}
            >
              {checkingDependencies ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking...
                </>
              ) : loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Convert to Bin
                </>
              )}
            </Button>
          </div>
        </form>
        </div>
      </div>

      {/* Active Shift Warning Dialog */}
      {location && (
        <ActiveShiftWarningDialog
          open={showWarningDialog}
          onOpenChange={setShowWarningDialog}
          onConfirm={handleWarningConfirm}
          dependencies={dependencies}
          resourceType="potential location"
          resourceName={location.street}
          changeAction="delete"
          changeDetails={`Converting ${location.street} to a bin will remove placement tasks`}
          loading={loading}
        />
      )}
    </>
  );
}
