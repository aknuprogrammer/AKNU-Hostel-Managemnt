import React, { useState } from 'react';
import { Hostel } from '../../types.js';
import { apiRequest } from '../../services/api.js';
import { useConfirm } from '../../context/ConfirmContext.js';
import { Modal, Button, Input, Select } from '../ui/index.js';
import { ArrowRightLeft } from 'lucide-react';

export interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  hostels: Hostel[];
  initialHostelId?: string;
  onSuccess: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  hostels,
  initialHostelId,
  onSuccess
}) => {
  const { showSuccess, showError } = useConfirm();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    studentId: '',
    toHostelId: initialHostelId || hostels[0]?.id || '',
    toRoomId: '',
    toBedId: '',
    reason: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await apiRequest<{ success: boolean; message: string }>('/hostels/transfers', {
        method: 'POST',
        body: form
      });
      if (res.success) {
        await showSuccess(res.message);
        onSuccess();
        onClose();
        setForm({
          studentId: '',
          toHostelId: initialHostelId || hostels[0]?.id || '',
          toRoomId: '',
          toBedId: '',
          reason: ''
        });
      }
    } catch (err: any) {
      await showError('Transfer failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Room / Hostel Transfer Workflow"
      size="md"
      icon={<ArrowRightLeft className="w-5 h-5 text-amber-500" />}
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-md border border-slate-200">
          Safely transfer a student between beds or hostels. Old allocation is vacated atomically and transfer history is logged.
        </p>

        <Input
          required
          label="Target Student ID"
          placeholder="e.g. AKNU-STU-1001"
          value={form.studentId}
          onChange={(e) => setForm({ ...form, studentId: e.target.value })}
        />

        <Select
          label="Target Hostel"
          value={form.toHostelId}
          onChange={(e) => setForm({ ...form, toHostelId: e.target.value })}
        >
          {hostels.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name} ({h.code})
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            required
            label="Target Room ID"
            placeholder="e.g. rm-bh1-102"
            value={form.toRoomId}
            onChange={(e) => setForm({ ...form, toRoomId: e.target.value })}
          />
          <Input
            required
            label="Target Bed ID"
            placeholder="e.g. bed-bh1-102-a"
            value={form.toBedId}
            onChange={(e) => setForm({ ...form, toBedId: e.target.value })}
          />
        </div>

        <Input
          required
          label="Transfer Justification Reason *"
          placeholder="e.g. Medical request / Academic branch wing adjustment"
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
        />

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
            {submitting ? 'Transferring...' : 'Confirm Transfer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
