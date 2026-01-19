'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getBinChecks, getBinMoves, type BinCheck, type BinMove } from '@/lib/api/bins';
import { BinWithPriority } from '@/lib/types/bin';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  X,
  MapPin,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Package,
  Clock,
  AlertTriangle,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface BinDetailDrawerProps {
  bin: BinWithPriority;
  onClose: () => void;
  onScheduleMove?: (bin: BinWithPriority) => void;
  onRetire?: (bin: BinWithPriority) => void;
}

export function BinDetailDrawer({ bin, onClose, onScheduleMove, onRetire }: BinDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'checks' | 'moves'>('overview');
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  // Fetch check history
  const { data: checks, isLoading: checksLoading } = useQuery({
    queryKey: ['bin-checks', bin.id],
    queryFn: () => getBinChecks(bin.id),
    enabled: activeTab === 'checks',
  });

  // Fetch move history
  const { data: moves, isLoading: movesLoading } = useQuery({
    queryKey: ['bin-moves', bin.id],
    queryFn: () => getBinMoves(bin.id),
    enabled: activeTab === 'moves',
  });

  const getPriorityColor = (score: number) => {
    if (score >= 1000) return 'text-red-600 bg-red-50';
    if (score >= 500) return 'text-orange-600 bg-orange-50';
    if (score >= 200) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return { label: 'Active', color: 'bg-green-100 text-green-700' };
      case 'retired':
        return { label: 'Retired', color: 'bg-gray-100 text-gray-600' };
      case 'pending_move':
        return { label: 'Pending Move', color: 'bg-blue-100 text-blue-700' };
      case 'in_storage':
        return { label: 'In Storage', color: 'bg-purple-100 text-purple-700' };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-600' };
    }
  };

  const status = getStatusBadge(bin.status);

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl z-50 overflow-hidden flex flex-col ${isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-gray-900">Bin {bin.bin_number}</h2>
                <Badge className={status.color}>{status.label}</Badge>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">
                  {bin.current_street}, {bin.city}, {bin.zip}
                </span>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex gap-2">
            <Button
              onClick={() => onScheduleMove?.(bin)}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Move
            </Button>
            <Button
              onClick={() => onRetire?.(bin)}
              variant="outline"
              className="flex-1"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Retire Bin
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex gap-6">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'checks', label: 'Check History' },
              { key: 'moves', label: 'Move History' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={cn(
                  'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
                  activeTab === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Package className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Fill Level</p>
                      <p className="text-xl font-bold text-gray-900">
                        {bin.fill_percentage || 0}%
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-50 rounded-lg">
                      <Clock className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Last Checked</p>
                      <p className="text-xl font-bold text-gray-900">
                        {bin.days_since_check !== undefined && bin.days_since_check !== null
                          ? `${bin.days_since_check}d ago`
                          : 'Never'}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Location Details */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Location Details</h3>
                <Card className="p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Street:</span>
                    <span className="font-medium text-gray-900">{bin.current_street}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">City:</span>
                    <span className="font-medium text-gray-900">{bin.city}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">ZIP:</span>
                    <span className="font-medium text-gray-900">{bin.zip}</span>
                  </div>
                  {bin.latitude && bin.longitude && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Coordinates:</span>
                      <span className="font-mono text-sm text-gray-900">
                        {bin.latitude.toFixed(6)}, {bin.longitude.toFixed(6)}
                      </span>
                    </div>
                  )}
                </Card>
              </div>

              {/* Priority Breakdown */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Priority Breakdown</h3>
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Base Score:</span>
                    <span className="font-bold text-gray-900">
                      {Math.round(bin.priority_score)}
                    </span>
                  </div>
                  {bin.fill_percentage && bin.fill_percentage >= 60 && (
                    <div className="flex items-center justify-between text-orange-600">
                      <span>High Fill Level:</span>
                      <span className="font-semibold">+{bin.fill_percentage >= 80 ? 300 : 150}</span>
                    </div>
                  )}
                  {bin.days_since_check && bin.days_since_check >= 7 && (
                    <div className="flex items-center justify-between text-red-600">
                      <span>Overdue Check:</span>
                      <span className="font-semibold">
                        +{bin.days_since_check >= 30 ? 800 : bin.days_since_check >= 14 ? 400 : 200}
                      </span>
                    </div>
                  )}
                  {bin.has_pending_move && (
                    <div className="flex items-center justify-between text-blue-600">
                      <span>Pending Move:</span>
                      <span className="font-semibold">
                        +{bin.move_request_urgency === 'urgent' ? 1000 : 400}
                      </span>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'checks' && (
            <div className="space-y-4">
              {checksLoading ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-gray-300 animate-pulse mx-auto mb-4" />
                  <p className="text-gray-500">Loading check history...</p>
                </div>
              ) : checks && checks.length > 0 ? (
                <div className="space-y-3">
                  {checks.map((check) => (
                    <Card key={check.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="font-medium text-gray-900">
                              {check.checkedByName || 'Unknown Driver'}
                            </span>
                            <Badge className="bg-gray-100 text-gray-700 text-xs">
                              {check.checkedFrom}
                            </Badge>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-600">Fill:</span>
                              <span className="font-semibold text-gray-900">
                                {check.fillPercentage !== null ? `${check.fillPercentage}%` : 'N/A'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-500">
                                {format(new Date(check.checkedOnIso), 'PPp')}
                              </span>
                            </div>
                          </div>
                        </div>
                        {check.photoUrl && (
                          <div className="ml-4">
                            <img
                              src={check.photoUrl}
                              alt="Check photo"
                              className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                            />
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No check history available</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'moves' && (
            <div className="space-y-4">
              {movesLoading ? (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-gray-300 animate-pulse mx-auto mb-4" />
                  <p className="text-gray-500">Loading move history...</p>
                </div>
              ) : moves && moves.length > 0 ? (
                <div className="space-y-3">
                  {moves.map((move) => (
                    <Card key={move.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <MapPin className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-gray-900">Location Change</span>
                            <span className="text-gray-500 text-sm">
                              {format(new Date(move.movedOnIso), 'PPp')}
                            </span>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div>
                              <span className="text-gray-600">From:</span>
                              <span className="ml-2 text-gray-900">{move.movedFrom}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">To:</span>
                              <span className="ml-2 text-gray-900">{move.movedTo}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No move history available</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
