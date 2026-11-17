import React, { useState, useEffect } from 'react';
import { Hostel } from '../../types.js';
import { apiRequest } from '../../services/api.js';
import { useConfirm } from '../../context/ConfirmContext.js';
import { Modal, Button, Input, Select } from '../ui/index.js';
import { Pencil } from 'lucide-react';

export interface EditHostelModalProps {
  isOpen: boolean;
  onClose: () => void;
  hostel: Hostel | null;
  userWing?: 'boys' | 'girls' | null;
  onSuccess: () => void;
}

export const EditHostelModal: React.FC<EditHostelModalProps> = ({
  isOpen,
  onClose,
  hostel,
  userWing,
  onSuccess
}) => {
  const { showSuccess, showError } = useConfirm();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    code: '',
    category: 'boys' as 'boys' | 'girls',
    campus: ''
  });

  useEffect(() => {
    if (hostel && isOpen) {
      setForm({
        name: hostel.name,
        code: hostel.code,
        category: hostel.category,
        campus: hostel.campus || ''
      });
    }
  }, [hostel, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostel) return;

    try {
      setSubmitting(true);
      const res = await apiRequest<{ success: boolean; data: any; message?: string }>(`/hostels/${hostel.id}`, {
        method: 'PUT',
        body: form
      });
      if (res.success) {
        await showSuccess(res.message || 'Hostel updated successfully');
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      await showError('Failed to update hostel: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Hostel: ${hostel?.name || ''}`}
      size="lg"
      icon={<Pencil className="w-5 h-5 text-indigo-600" />}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            required
            label="Hostel Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <Input
            required
            label="Hostel Short Code"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            className="uppercase font-mono font-bold"
          />

          <Select
            label="Wing / Category"
            value={form.category}
            disabled={!!userWing}
            onChange={(e) => {
              const cat = e.target.value as 'boys' | 'girls';
              setForm({ ...form, category: cat });
            }}
          >
            {userWing === 'boys' ? (
              <option value="boys">Boys Wing (Male Students)</option>
            ) : userWing === 'girls' ? (
              <option value="girls">Girls Wing (Female Students)</option>
            ) : (
              <>
                <option value="boys">Boys Wing (Male Students)</option>
                <option value="girls">Girls Wing (Female Students)</option>
              </>
            )}
          </Select>

          <Input
            label="Campus Location"
            value={form.campus}
            onChange={(e) => setForm({ ...form, campus: e.target.value })}
          />
        </div>

        <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
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
            {submitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
