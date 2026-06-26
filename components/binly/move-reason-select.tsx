'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';

export const MOVE_REASONS = [
  { value: 'landlord_complaint', label: 'Landlord Complaint' },
  { value: 'low_performance', label: 'Low Performance' },
  { value: 'vandalism_theft', label: 'Vandalism / Theft' },
  { value: 'bin_damaged', label: 'Bin Damaged' },
  { value: 'area_unsuitable', label: 'Area No Longer Suitable' },
  { value: 'relocation_optimization', label: 'Relocation for Better Spot' },
  { value: 'other', label: 'Other' },
] as const;

export type MoveReasonValue = typeof MOVE_REASONS[number]['value'];

interface MoveReasonSelectProps {
  value: string;
  onChange: (reason: string) => void;
  error?: boolean;
}

export function MoveReasonSelect({ value, onChange, error }: MoveReasonSelectProps) {
  // Check if the current value matches a predefined reason
  const matchedReason = MOVE_REASONS.find(r => r.value === value);
  const isOther = value && !matchedReason;
  const selectedValue = isOther ? 'other' : (matchedReason?.value || '');
  const [otherText, setOtherText] = useState(isOther ? value : '');

  const handleSelectChange = (newValue: string) => {
    if (newValue === 'other') {
      onChange(otherText || 'other');
    } else {
      onChange(newValue);
      setOtherText('');
    }
  };

  const handleOtherTextChange = (text: string) => {
    setOtherText(text);
    onChange(text || 'other');
  };

  return (
    <div className="space-y-2">
      <select
        value={selectedValue}
        onChange={(e) => handleSelectChange(e.target.value)}
        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none bg-white ${
          error && !value ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-300'
        }`}
      >
        <option value="" disabled>Select a reason...</option>
        {MOVE_REASONS.map(r => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>

      {selectedValue === 'other' && (
        <input
          type="text"
          value={otherText}
          onChange={(e) => handleOtherTextChange(e.target.value)}
          placeholder="Please describe the reason..."
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
            error && (!otherText || otherText === 'other') ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-300'
          }`}
        />
      )}

      {error && !value && (
        <p className="flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="w-3 h-3" />
          Reason is required
        </p>
      )}
    </div>
  );
}

/** Get display label for a stored reason value */
export function getReasonLabel(reason: string): string {
  const match = MOVE_REASONS.find(r => r.value === reason);
  return match ? match.label : reason;
}
