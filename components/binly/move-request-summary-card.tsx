'use client';

import { MoveRequest } from '@/lib/types/bin';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, User, Package, ArrowRight, Warehouse } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface MoveRequestSummaryCardProps {
  moveRequest: MoveRequest;
}

const getMoveTypeBadgeColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'assigned':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'in_progress':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'completed':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'cancelled':
      return 'bg-gray-100 text-gray-700 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

export function MoveRequestSummaryCard({ moveRequest }: MoveRequestSummaryCardProps) {
  const getMoveTypeInfo = () => {
    switch (moveRequest.move_type) {
      case 'store':
        return {
          icon: <Warehouse className="w-6 h-6 text-blue-600" />,
          title: 'Store Move',
          description: 'Pickup and warehouse storage',
          bgColor: 'bg-blue-50',
        };
      case 'relocation':
        return {
          icon: <ArrowRight className="w-6 h-6 text-purple-600" />,
          title: 'Relocation',
          description: 'Move to new address',
          bgColor: 'bg-purple-50',
        };
      case 'redeployment':
        return {
          icon: <Package className="w-6 h-6 text-green-600" />,
          title: 'Redeployment',
          description: 'Deploy from warehouse to field',
          bgColor: 'bg-green-50',
        };
      default:
        return {
          icon: <ArrowRight className="w-6 h-6 text-gray-600" />,
          title: moveRequest.move_type,
          description: 'Bin move',
          bgColor: 'bg-gray-50',
        };
    }
  };

  const typeInfo = getMoveTypeInfo();

  return (
    <Card className="p-4 md:p-6 border-l-4 border-l-primary">
      <div className="space-y-4">
        {/* Move Type Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', typeInfo.bgColor)}>
              {typeInfo.icon}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{typeInfo.title}</p>
              <p className="text-sm text-gray-600">{typeInfo.description}</p>
            </div>
          </div>
          <Badge className={cn('border', getMoveTypeBadgeColor(moveRequest.status))}>
            {moveRequest.status.toUpperCase()}
          </Badge>
        </div>

        {/* Details Grid */}
        <div className="space-y-2 text-sm">
          {/* Scheduled Date */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-600">
              {moveRequest.status === 'completed' ? 'Completed:' : 'Scheduled:'}
            </span>
            <span className="font-medium text-gray-900">
              {moveRequest.status === 'completed' && moveRequest.completed_at_iso
                ? format(new Date(moveRequest.completed_at_iso), 'PPp')
                : format(new Date(moveRequest.scheduled_date * 1000), 'PPp')}
            </span>
          </div>

          {/* From Address */}
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="text-gray-600">From:</span>
              <span className="font-medium text-gray-900 ml-1">
                {moveRequest.original_address ||
                  `${moveRequest.current_street}, ${moveRequest.city}, ${moveRequest.zip}`}
              </span>
            </div>
          </div>

          {/* To Address (for relocation/redeployment/store) */}
          {(moveRequest.move_type === 'relocation' ||
            moveRequest.move_type === 'redeployment' ||
            moveRequest.move_type === 'store') && moveRequest.new_address && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-gray-600">To:</span>
                <span className="font-medium text-gray-900 ml-1">
                  {moveRequest.new_address}
                </span>
              </div>
            </div>
          )}

          {/* Assignment */}
          {moveRequest.assigned_driver_name && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-600">Assigned to:</span>
              <span className="font-medium text-gray-900">
                {moveRequest.assigned_driver_name}
              </span>
            </div>
          )}

          {/* Notes */}
          {moveRequest.notes && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs font-medium text-gray-700 mb-1">Notes:</p>
              <p className="text-sm text-gray-900">{moveRequest.notes}</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
