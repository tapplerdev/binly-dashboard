'use client';

import { useState, useEffect } from 'react';
import { MapPin, User, Calendar, Check, Trash2, Loader2, MoreVertical, Eye, ChevronsUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PotentialLocationDetailsDrawer } from './potential-location-details-drawer';
import { ConvertToBinDialog } from './convert-to-bin-dialog';
import { DeleteConfirmDialog } from './delete-confirm-dialog';
import { cn } from '@/lib/utils';

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

type SortColumn = 'street' | 'requested_by_name' | 'created_at_iso';

export function PotentialLocationsList({ onCreateNew }: PotentialLocationsListProps) {
  const [locations, setLocations] = useState<PotentialLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'converted'>('active');
  const [selectedLocation, setSelectedLocation] = useState<PotentialLocation | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<PotentialLocation | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchLocations();
  }, [filter]);

  useEffect(() => {
    // Listen for create events to refresh the list
    const handleRefresh = () => fetchLocations();
    window.addEventListener('potential-location-created', handleRefresh);
    return () => window.removeEventListener('potential-location-created', handleRefresh);
  }, [filter]);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

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

  // Handle column sorting
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Sort locations based on selected column
  const sortedLocations = [...locations].sort((a, b) => {
    if (!sortColumn) return 0;

    let comparison = 0;
    switch (sortColumn) {
      case 'street':
        comparison = a.street.localeCompare(b.street);
        break;
      case 'requested_by_name':
        comparison = a.requested_by_name.localeCompare(b.requested_by_name);
        break;
      case 'created_at_iso':
        comparison = new Date(a.created_at_iso).getTime() - new Date(b.created_at_iso).getTime();
        break;
      default:
        return 0;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return (
    <>
      <div className="bg-white rounded-2xl card-shadow">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Potential Locations
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {filter === 'active' ? 'Active location requests' : 'Converted to bins'}
              </p>
            </div>

            {/* Filter Toggle and Create Button */}
            <div className="flex items-center gap-3">
              {/* Create Button */}
              <Button
                onClick={onCreateNew}
                className="bg-primary hover:bg-primary/90 gap-2"
              >
                <MapPin className="w-4 h-4" />
                Add Location
              </Button>

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
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th
                    className="text-left py-4 px-4 text-sm font-semibold text-gray-700 align-middle rounded-tl-2xl cursor-pointer"
                    onClick={() => handleSort('street')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Address</span>
                      <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                    </div>
                  </th>
                  <th
                    className="text-left py-4 px-4 text-sm font-semibold text-gray-700 align-middle cursor-pointer"
                    onClick={() => handleSort('requested_by_name')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Requested By</span>
                      <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                    </div>
                  </th>
                  <th
                    className="text-left py-4 px-4 text-sm font-semibold text-gray-700 align-middle cursor-pointer"
                    onClick={() => handleSort('created_at_iso')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Date Created</span>
                      <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                    </div>
                  </th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-gray-700 align-middle rounded-tr-2xl">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedLocations.map((location) => (
                  <tr
                    key={location.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedLocation(location)}
                  >
                    <td className="py-4 px-4 align-middle">
                      <div className="text-sm">
                        <div className="text-gray-900 font-medium">{location.street}</div>
                        <div className="text-gray-500 text-xs">
                          {location.city}, {location.zip}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 align-middle">
                      <span className="text-sm text-gray-900">
                        {location.requested_by_name}
                      </span>
                    </td>
                    <td className="py-4 px-4 align-middle">
                      <span className="text-sm text-gray-600">
                        {formatDate(location.created_at_iso)}
                      </span>
                    </td>
                    <td className="py-4 px-4 align-middle">
                      <div className="flex items-center justify-center gap-2">
                        {filter === 'active' ? (
                          <>
                            {/* View Details Icon */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLocation(location);
                              }}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4 text-gray-600" />
                            </button>

                            {/* More Actions Menu */}
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(openMenuId === location.id ? null : location.id);
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                title="More Actions"
                              >
                                <MoreVertical className="w-4 h-4 text-gray-600" />
                              </button>

                              {/* Dropdown Menu */}
                              {openMenuId === location.id && (
                                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[160px] animate-slide-in-down">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenMenuId(null);
                                      handleConvert(location);
                                    }}
                                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors rounded-t-lg"
                                  >
                                    Convert to Bin
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenMenuId(null);
                                      handleDelete(location);
                                    }}
                                    className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors rounded-b-lg"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                            </div>
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
