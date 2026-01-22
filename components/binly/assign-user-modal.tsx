'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assignMoveToUser } from '@/lib/api/move-requests';
import { getUsers, User as UserType } from '@/lib/api/users';
import { MoveRequest } from '@/lib/types/bin';
import { Button } from '@/components/ui/button';
import { X, User, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssignUserModalProps {
  moveRequest: MoveRequest;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AssignUserModal({ moveRequest, onClose, onSuccess }: AssignUserModalProps) {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  // Fetch users
  const { data: users, isLoading: usersLoading } = useQuery<UserType[]>({
    queryKey: ['users'],
    queryFn: getUsers,
  });

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) throw new Error('No user selected');

      await assignMoveToUser({
        move_request_id: moveRequest.id,
        user_id: selectedUserId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['move-requests'] });
      alert('Successfully assigned move to user');
      onSuccess?.();
      handleClose();
    },
    onError: (error) => {
      console.error('Failed to assign move:', error);
      alert('Failed to assign move. Please try again.');
    },
  });

  const handleAssign = () => {
    if (!selectedUserId) {
      alert('Please select a user');
      return;
    }

    assignMutation.mutate();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 flex items-center justify-center p-4 ${
          isClosing ? 'animate-fade-out' : 'animate-fade-in'
        }`}
        onClick={handleClose}
      >
        {/* Modal */}
        <div
          className={`bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col ${
            isClosing ? 'animate-scale-out' : 'animate-scale-in'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  Assign to Person
                </h2>
                <p className="text-sm text-gray-600">
                  Bin #{moveRequest.bin_number} - One-off manual task
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-purple-600 mt-0.5" />
                <div className="text-sm text-purple-800">
                  This will create a one-off manual task assignment. It will not be part of a regular shift route.
                </div>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-gray-700 mb-3">Select Person:</h3>

            {usersLoading ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 text-gray-300 animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-500">Loading users...</p>
              </div>
            ) : users && users.length > 0 ? (
              <div className="space-y-2">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUserId(user.id)}
                    className={cn(
                      'w-full text-left p-4 rounded-xl border-2 transition-all',
                      selectedUserId === user.id
                        ? 'border-primary bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-gray-600" />
                      <div>
                        <div className="font-semibold text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500 capitalize">{user.role}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No users found</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleAssign}
                disabled={!selectedUserId || assignMutation.isPending}
                className="bg-primary hover:bg-primary/90"
              >
                <User className="w-4 h-4 mr-2" />
                {assignMutation.isPending ? 'Assigning...' : 'Assign to Person'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
