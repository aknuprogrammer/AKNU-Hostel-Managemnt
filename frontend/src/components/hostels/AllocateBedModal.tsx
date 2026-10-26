import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.js';
import { useConfirm } from '../../context/ConfirmContext.js';
import { Modal, Button, Input, Select } from '../ui/index.js';
import { Bed } from 'lucide-react';
import { Hostel } from '../../types.js';

export interface AllocateBedModalProps {
  isOpen: boolean;
  onClose: () => void;
  bed: any | null;
  hostel: Hostel | null;
  onSuccess: () => void;
}

export const AllocateBedModal: React.FC<AllocateBedModalProps> = ({
  isOpen,
  onClose,
  bed,
  hostel,
  onSuccess
}) => {
  const { showSuccess, showError } = useConfirm();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && bed && hostel) {
      setSelectedStudentId('');
      setNotes('');
      const targetGender = hostel.category === 'girls' ? 'female' : 'male';
      apiRequest<{ success: boolean; data: any[] }>(`/hostels/batch/unallocated-candidates?gender=${targetGender}`)
        .then((res) => {
          if (res.success && res.data) {
            setCandidates(res.data);
            if (res.data.length > 0) {
              setSelectedStudentId(res.data[0].id);
            }
          }
        })
        .catch((e) => console.error('Failed to fetch unallocated candidates for bed:', e));
    }
  }, [isOpen, bed, hostel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !bed || !hostel) return;

    try {
      setSubmitting(true);
      const res = await apiRequest<{ success: boolean; message: string }>('/hostels/allocations', {
        method: 'POST',
        body: {
          studentId: selectedStudentId,
          hostelId: bed.hostel_id || hostel.id,
          roomId: bed.room_id,
          bedId: bed.bed_id,
          checkInDate: new Date().toISOString().split('T')[0],
          notes: notes || undefined
        }
      });
      if (res.success) {
        await showSuccess(res.message);
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      await showError('Allocation error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Allocate Bed: Room ${bed?.room_number || ''} • ${bed?.bed_number || ''}`}
      size="md"
      icon={<Bed className="w-5 h-5 text-emerald-600" />}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Hostel:</span>
            <span className="font-bold text-slate-800">{hostel?.name} ({hostel?.code})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Room & Bed:</span>
            <span className="font-bold text-slate-800">Room {bed?.room_number} • {bed?.bed_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Wing Eligibility:</span>
            <span className="font-bold text-slate-800 uppercase">{hostel?.category === 'girls' ? 'Female Students' : 'Male Students'}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Select Unallocated Student <span className="text-red-500">*</span>
          </label>
          {candidates.length > 0 ? (
            <Select
              required
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              options={candidates.map((c) => ({
                value: c.id,
                label: `${c.full_name} (${c.roll_number}) • ${c.department_code || c.department_name || ''} - Year ${c.year_of_study || 1}`
              }))}
            />
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
              No unallocated {hostel?.category === 'girls' ? 'female' : 'male'} students found in database.
            </div>
          )}
        </div>

        <div>
          <Input
            label="Allocation Notes / Reference (Optional)"
            placeholder="e.g. Regular semester admission 2026-27"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
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
            disabled={submitting || !selectedStudentId}
          >
            {submitting ? 'Allocating...' : 'Confirm Allocation'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
