'use client';

import { useState, useEffect } from 'react';
import { MapPin, User, Calendar, Check, Trash2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PotentialLocationDetailsDrawer } from './potential-location-details-drawer';
import { ConvertToBinDialog } from './convert-to-bin-dialog';
import { DeleteConfirmDialog } from './delete-confirm-dialog';

interface PotentialLocation {
  id: string;
  address: string;
  street: string;
  city: string;
  zip: string;
  latitude?: number;
  longitude?: number;
  requested_by_user_id: string;
  requested_by_name: string;
  notes?: string;
  created_at_iso: string;
  converted_to_bin_id?: string;
  converted_at_iso?: string;
  converted_by_user_id?: string;
  bin_number?: number;
}

interface PotentialLocationsListProps {
  onCreateNew: () => void;
}

export function PotentialLocationsList({ onCreateNew }: PotentialLocationsListProps) {
  const [locations, setLocations] = useState<PotentialLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'converted'>('active');
  const [selectedLocation, setSelectedLocation] = useState<PotentialLocation | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<PotentialLocation | null>(null);

  useEffect(() => {
    fetchLocations();
  }, [filter]);

  useEffect(() => {
    // Listen for create events to refresh the list
    const handleRefresh = () => fetchLocations();
    window.addEventListener('potential-location-created', handleRefresh);
    return () => window.removeEventListener('potential-location-created', handleRefresh);
  }, [filter]);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://ropacal-backend-production.up.railway.app/api/potential-locations?status=${filter === 'converted' ? 'converted' : 'active'}`
      );
      const data = await response.json();
      setLocations(data || []);
    } catch (error) {
      console.error('Error fetching potential locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = (location: PotentialLocation) => {
    setSelectedLocation(location);
    setConvertDialogOpen(true);
  };

  const handleDelete = (location: PotentialLocation) => {
    setLocationToDelete(location);
    setDeleteDialogOpen(true);
  };

  const handleConvertSuccess = () => {
    setConvertDialogOpen(false);
    setSelectedLocation(null);
    fetchLocations();
  };

  const handleDeleteSuccess = () => {
    setDeleteDialogOpen(false);
    setLocationToDelete(null);
    fetchLocations();
  };

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <>
      <div className="bg-white rounded-2xl card-shadow">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Potential Locations ({locations.length})
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {filter === 'active' ? 'Active location requests' : 'Converted to bins'}
              </p>
            </div>

            {/* Filter Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('active')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === 'active'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setFilter('converted')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === 'converted'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Converted
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : locations.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No potential locations found
              </h3>
              <p className="text-gray-600 mb-4">
                {filter === 'active'
                  ? 'Create a new potential location to get started'
                  : 'No locations have been converted yet'}
              </p>
              {filter === 'active' && (
                <Button onClick={onCreateNew} className="gap-2">
                  <MapPin className="w-4 h-4" />
                  Add Location
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Address
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Requested By
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Date Created
                    </div>
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {locations.map((location) => (
                  <tr
                    key={location.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedLocation(location)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{location.street}</p>
                          <p className="text-sm text-gray-600">
                            {location.city}, {location.zip}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                          <User className="w-4 h-4 text-purple-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {location.requested_by_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {formatDate(location.created_at_iso)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {filter === 'active' ? (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              className="gap-2"
                              onClick={() => handleConvert(location)}
                            >
                              <Check className="w-4 h-4" />
                              Convert to Bin
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="gap-2"
                              onClick={() => handleDelete(location)}
                            >
                              <Trash2 className="w-4 h-4" />
                              Remove
                            </Button>
                          </>
                        ) : (
                          <Badge variant="default" className="gap-1">
                            <Check className="w-3 h-3" />
                            Bin #{location.bin_number}
                          </Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Details Drawer */}
      {selectedLocation && (
        <PotentialLocationDetailsDrawer
          location={selectedLocation}
          onClose={() => setSelectedLocation(null)}
          onConvert={() => {
            setConvertDialogOpen(true);
          }}
          onDelete={() => {
            setLocationToDelete(selectedLocation);
            setDeleteDialogOpen(true);
          }}
        />
      )}

      {/* Convert Dialog */}
      <ConvertToBinDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        location={selectedLocation}
        onSuccess={handleConvertSuccess}
      />

      {/* Delete Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        location={locationToDelete}
        onSuccess={handleDeleteSuccess}
      />
    </>
  );
}
