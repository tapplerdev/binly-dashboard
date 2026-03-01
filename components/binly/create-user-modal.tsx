'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createUser, type CreateUserRequest } from '@/lib/api/users';
import { Card } from '@/components/ui/card';
import { X, Loader2, User, Mail, Lock, ShieldCheck, UserPlus } from 'lucide-react';

interface CreateUserModalProps {
  defaultRole: 'driver' | 'admin';
  onClose: () => void;
}

export function CreateUserModal({ defaultRole, onClose }: CreateUserModalProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [formData, setFormData] = useState<CreateUserRequest>({
    email: '',
    password: '',
    name: '',
    role: defaultRole,
  });
  const queryClient = useQueryClient();

  // Get auth token from localStorage
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

  const createUserMutation = useMutation({
    mutationFn: (data: CreateUserRequest) => createUser(data, token),
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      queryClient.invalidateQueries({ queryKey: ['all-drivers'] });
      handleClose();
    },
  });

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createUserMutation.mutate(formData);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={'fixed inset-0 bg-black/50 z-40 ' + (isClosing ? 'animate-fade-out' : 'animate-fade-in')}
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className={'w-full max-w-lg bg-white rounded-2xl shadow-2xl pointer-events-auto m-4 ' + (isClosing ? 'animate-scale-out' : 'animate-scale-in')}
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-primary/5 to-transparent">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Add New {defaultRole === 'driver' ? 'Driver' : 'Administrator'}</h2>
            <p className="text-sm text-gray-500 mt-1">Create a new account for your team</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2.5">
              Full Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none text-gray-900 placeholder-gray-400"
                placeholder="John Doe"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2.5">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none text-gray-900 placeholder-gray-400"
                placeholder="john@ropacal.com"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none text-gray-900 placeholder-gray-400"
                placeholder="Minimum 6 characters"
                required
                minLength={6}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1.5">Must be at least 6 characters long</p>
          </div>

          {/* Error Message */}
          {createUserMutation.isError && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
              <p className="text-sm text-red-800 font-medium">
                {createUserMutation.error instanceof Error
                  ? createUserMutation.error.message
                  : 'Failed to create user'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createUserMutation.isPending}
              className="flex-1 px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              {createUserMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Create {defaultRole === 'driver' ? 'Driver' : 'Admin'}
                </>
              )}
            </button>
          </div>
        </form>
        </div>
      </div>
    </>
  );
}
