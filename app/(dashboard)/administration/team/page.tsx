'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAllDrivers, type Driver } from '@/lib/api/team';
import { getAllUsers, type User } from '@/lib/api/users';
import { DriverDetailDrawer } from '@/components/binly/driver-detail-drawer';
import { CreateUserModal } from '@/components/binly/create-user-modal';
import { Card } from '@/components/ui/card';
import { Users, UserCheck, UserX, TrendingUp, Loader2, Circle, UserPlus, Shield } from 'lucide-react';

export default function TeamPage() {
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [activeTab, setActiveTab] = useState<'drivers' | 'admins'>('drivers');
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);

  // Get auth token from localStorage (Zustand persist storage)
  const getAuthToken = () => {
    try {
      const authStorage = localStorage.getItem('binly-auth-storage');
      if (!authStorage) return null;

      const parsed = JSON.parse(authStorage);
      return parsed?.state?.token || null;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  };

  const token = getAuthToken() || '';

  const { data: drivers, isLoading: loadingDrivers } = useQuery({
    queryKey: ['all-drivers'],
    queryFn: () => getAllDrivers(token),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => getAllUsers(token),
  });

  const activeDrivers = drivers?.filter((d) => d.status === 'active' || d.status === 'ready') || [];
  const driversOnShift = drivers?.filter((d) => d.shift_id) || [];
  const totalDrivers = drivers?.length || 0;
  const admins = users?.filter((u) => u.role === 'admin') || [];
  const isLoading = loadingDrivers || loadingUsers;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600';
      case 'ready':
        return 'text-blue-600';
      case 'paused':
        return 'text-yellow-600';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'On Active Shift';
      case 'ready':
        return 'Ready';
      case 'paused':
        return 'Paused';
      default:
        return 'Offline';
    }
  };

  return (
    <div className="p-4 md:p-8">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Drivers</p>
              <p className="text-2xl font-bold text-gray-900">{totalDrivers}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">On Shift</p>
              <p className="text-2xl font-bold text-gray-900">{driversOnShift.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active/Ready</p>
              <p className="text-2xl font-bold text-gray-900">{activeDrivers.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('drivers')}
            className={'py-3 px-1 border-b-2 font-medium text-sm transition-colors ' + (activeTab === 'drivers' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300')}
          >
            Drivers ({totalDrivers})
          </button>
          <button
            onClick={() => setActiveTab('admins')}
            className={'py-3 px-1 border-b-2 font-medium text-sm transition-colors ' + (activeTab === 'admins' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300')}
          >
            Admins ({admins.length})
          </button>
        </div>
      </div>

      {/* Drivers Tab */}
      {activeTab === 'drivers' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Driver Roster</h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : !drivers || drivers.length === 0 ? (
          <div className="text-center py-12">
            <UserX className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No drivers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Current Shift
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Last Update
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {drivers.map((driver) => (
                  <tr
                    key={driver.driver_id}
                    onClick={() => setSelectedDriver(driver)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{driver.driver_name}</p>
                        <p className="text-sm text-gray-500">{driver.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Circle
                          className={`w-2 h-2 fill-current ${getStatusColor(driver.status)}`}
                        />
                        <span className="text-sm text-gray-700">{getStatusText(driver.status)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {driver.shift_id ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Active
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {driver.shift_id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-700">
                            {driver.completed_bins}/{driver.total_bins}
                          </span>
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full"
                              style={{
                                width: `${(driver.completed_bins / driver.total_bins) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {driver.updated_at ? (
                        <span className="text-sm text-gray-500">
                          {Math.round((Date.now() / 1000 - driver.updated_at) / 60)}m ago
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </Card>
      )}

      {/* Admins Tab */}
      {activeTab === 'admins' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Administrators</h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          ) : !admins || admins.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No administrators found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {admins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                            <Shield className="w-4 h-4 text-white" />
                          </div>
                          <p className="font-medium text-gray-900">{admin.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-gray-700">{admin.email}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-gray-500">
                          {new Date(admin.created_at * 1000).toLocaleDateString()}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Floating Add User Button */}
      <button
        onClick={() => setShowCreateUserModal(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:bg-primary/90 transition-all hover:scale-110 flex items-center justify-center z-30"
        title="Add New User"
      >
        <UserPlus className="w-6 h-6" />
      </button>

      {/* Create User Modal */}
      {showCreateUserModal && (
        <CreateUserModal onClose={() => setShowCreateUserModal(false)} />
      )}

      {/* Driver Detail Drawer */}
      {selectedDriver && (
        <DriverDetailDrawer driver={selectedDriver} onClose={() => setSelectedDriver(null)} />
      )}
    </div>
  );
}
