import React, { useState } from 'react';
import { apiRequest } from '../../services/api.js';
import { useConfirm } from '../../context/ConfirmContext.js';
import { Modal, Button, Input, Select, NumberInput } from '../ui/index.js';
import { DoorClosed } from 'lucide-react';

export interface AddRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  hostelId: string;
  hostelName?: string;
  onSuccess: () => void;
}

export const AddRoomModal: React.FC<AddRoomModalProps> = ({
  isOpen,
  onClose,
  hostelId,
  hostelName,
  onSuccess
}) => {
  const { showSuccess, showError } = useConfirm();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    roomNumber: '',
    floorNumber: 1 as number | string,
    capacity: 2 as number | string,
    roomType: 'double'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostelId) return;

    try {
      setSubmitting(true);
      const res = await apiRequest<{ success: boolean; message: string }>(`/hostels/${hostelId}/rooms`, {
        method: 'POST',
        body: {
          ...form,
          floorNumber: Math.max(1, parseInt(String(form.floorNumber), 10) || 1),
          capacity: Math.max(1, parseInt(String(form.capacity), 10) || 2)
        }
      });
      if (res.success) {
        await showSuccess(res.message);
        onSuccess();
        onClose();
        setForm({ roomNumber: '', floorNumber: 1, capacity: 2, roomType: 'double' });
      }
    } catch (err: any) {
      await showError('Failed to add room: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Add Room to ${hostelName || 'Hostel'}`}
      size="md"
      icon={<DoorClosed className="w-5 h-5 text-[#23395D]" />}
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Input
            required
            label="Room Number"
            placeholder="e.g. 106 or 201"
            value={form.roomNumber}
            onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
            className="font-mono font-bold"
          />

          <NumberInput
            label="Floor Number"
            min={1}
            max={15}
            value={form.floorNumber}
            onChange={(val) => setForm((prev) => ({ ...prev, floorNumber: val }))}
          />

          <NumberInput
            label="Bed Capacity"
            min={1}
            max={8}
            value={form.capacity}
            onChange={(val) => {
              const type = val === 1 ? 'single' : val === 2 ? 'double' : val === 3 ? 'triple' : 'four_share';
              setForm((prev) => ({ ...prev, capacity: val, roomType: type }));
            }}
          />

          <Select
            label="Room Type"
            value={form.roomType}
            onChange={(e) => setForm({ ...form, roomType: e.target.value })}
          >
            <option value="single">Single (1 Bed)</option>
            <option value="double">Double (2 Beds)</option>
            <option value="triple">Triple (3 Beds)</option>
            <option value="four_share">Four Share (4 Beds)</option>
            <option value="dormitory">Dormitory</option>
          </Select>
        </div>

        <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
          >
            {submitting ? 'Adding...' : 'Add Room'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
