'use client';

import { useState, useEffect } from 'react';
import { MapPin, User, Calendar, Check, Trash2, Loader2, MoreVertical, Eye, ChevronsUpDown, Truck, UserCog } from 'lucide-react';
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
  converted_via_shift_id?: string;
  converted_by_driver_name?: string;
  converted_by_manager_name?: string;
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
  const [sortColumn, setSortColumn] = useState<SortColumn | null>('created_at_iso');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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
        <div className="p-3 md:p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-gray-900">
                Potential Locations
              </h2>
              <p className="text-xs md:text-sm text-gray-600 mt-1">
                {filter === 'active' ? 'Active location requests' : 'Converted to bins'}
              </p>
            </div>

            {/* Filter Toggle and Create Button */}
            <div className="flex items-center gap-2 md:gap-3">
              {/* Filter Toggle */}
              <div className="flex gap-1.5 md:gap-2">
                <button
                  onClick={() => setFilter('active')}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
                    filter === 'active'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setFilter('converted')}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
                    filter === 'converted'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Converted
                </button>
              </div>

              {/* Create Button */}
              <Button
                onClick={onCreateNew}
                className="bg-primary hover:bg-primary/90 gap-1.5 md:gap-2 text-xs md:text-sm px-3 md:px-4 py-1.5 md:py-2 h-auto"
              >
                <MapPin className="w-3.5 md:w-4 h-3.5 md:h-4" />
                <span className="hidden sm:inline">Add Location</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Loading & Empty States */}
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
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
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
                  {filter === 'converted' && (
                    <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700 align-middle">
                      Conversion Type
                    </th>
                  )}
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
                    {filter === 'converted' && (
                      <td className="py-4 px-4 align-middle">
                        {location.converted_via_shift_id ? (
                          <Badge variant="secondary" className="gap-1 bg-blue-100 text-blue-700 hover:bg-blue-200">
                            <Truck className="w-3 h-3" />
                            Driver Placement
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1 bg-purple-100 text-purple-700 hover:bg-purple-200">
                            <UserCog className="w-3 h-3" />
                            Manager Conversion
                          </Badge>
                        )}
                      </td>
                    )}
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
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden p-3 space-y-3">
              {sortedLocations.map((location) => (
                <div
                  key={location.id}
                  onClick={() => setSelectedLocation(location)}
                  className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer"
                >
                  {/* Header - Address */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="text-base font-semibold text-gray-900 mb-1">
                        {location.street}
                      </div>
                      <div className="text-sm text-gray-500">
                        {location.city}, {location.zip}
                      </div>
                    </div>
                    {filter === 'converted' && (
                      <div className="flex flex-col gap-2 shrink-0 ml-2">
                        <Badge variant="default" className="gap-1">
                          <Check className="w-3 h-3" />
                          Bin #{location.bin_number}
                        </Badge>
                        {location.converted_via_shift_id ? (
                          <Badge variant="secondary" className="gap-1 bg-blue-100 text-blue-700 hover:bg-blue-200">
                            <Truck className="w-3 h-3" />
                            Driver
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1 bg-purple-100 text-purple-700 hover:bg-purple-200">
                            <UserCog className="w-3 h-3" />
                            Manager
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Requested By */}
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="text-sm">
                      <span className="text-gray-500">Requested by:</span>{' '}
                      <span className="text-gray-900 font-medium">
                        {location.requested_by_name}
                      </span>
                    </div>
                  </div>

                  {/* Date Created */}
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="text-sm">
                      <span className="text-gray-500">Created:</span>{' '}
                      <span className="text-gray-900">{formatDate(location.created_at_iso)}</span>
                    </div>
                  </div>

                  {/* Action Buttons - Only for active locations */}
                  {filter === 'active' && (
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLocation(location);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1.5" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConvert(location);
                        }}
                      >
                        <Check className="w-4 h-4 mr-1.5" />
                        Convert
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 px-3 border-red-200 text-red-600 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(location);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
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
