import React, { useState } from 'react';
import { apiRequest } from '../../services/api.js';
import { useConfirm } from '../../context/ConfirmContext.js';
import { Modal, Button, Input, Select } from '../ui/index.js';
import { Bed } from 'lucide-react';

export interface AddBedModalProps {
  isOpen: boolean;
  onClose: () => void;
  hostelName?: string;
  rooms: { room_id: string; room_number: string; count: number }[];
  defaultRoomId?: string;
  onSuccess: () => void;
}

export const AddBedModal: React.FC<AddBedModalProps> = ({
  isOpen,
  onClose,
  hostelName,
  rooms,
  defaultRoomId,
  onSuccess
}) => {
  const { showSuccess, showError, showWarning } = useConfirm();
  const [roomId, setRoomId] = useState(defaultRoomId || rooms[0]?.room_id || '');
  const [bedNumber, setBedNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Sync default room if props change
  React.useEffect(() => {
    if (defaultRoomId) {
      setRoomId(defaultRoomId);
    } else if (rooms.length > 0 && !roomId) {
      setRoomId(rooms[0].room_id);
    }
  }, [defaultRoomId, rooms]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId) {
      await showWarning('Please select a room to add a bed.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiRequest<{ success: boolean; message: string }>(`/hostels/rooms/${roomId}/beds`, {
        method: 'POST',
        body: {
          bedNumber: bedNumber.trim() || undefined
        }
      });
      if (res.success) {
        await showSuccess(res.message || 'Bed added successfully.');
        onSuccess();
        onClose();
        setBedNumber('');
      }
    } catch (err: any) {
      await showError('Add bed failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Add Bed to Room: ${hostelName || ''}`}
      size="md"
      icon={<Bed className="w-5 h-5 text-indigo-600" />}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Select Room <span className="text-red-500">*</span>
          </label>
          {rooms.length > 0 ? (
            <Select
              required
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              options={rooms.map((r) => ({
                value: r.room_id,
                label: `Room ${r.room_number} (Currently has ${r.count} bed${r.count === 1 ? '' : 's'})`
              }))}
            />
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
              No rooms configured in this hostel yet.
            </div>
          )}
        </div>

        <div>
          <Input
            label="Bed Label / Number (Optional)"
            placeholder="e.g. Bed 3 (leave blank for automatic sequence)"
            value={bedNumber}
            onChange={(e) => setBedNumber(e.target.value)}
          />
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            If left blank, the system will automatically label it (e.g. Bed 3, Bed 4).
          </span>
        </div>

        <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting || !roomId}
          >
            {submitting ? 'Adding Bed...' : 'Add Bed to Room'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
