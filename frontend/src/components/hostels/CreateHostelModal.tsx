import React, { useState } from 'react';
import { apiRequest } from '../../services/api.js';
import { useConfirm } from '../../context/ConfirmContext.js';
import { Modal, Button, Input, Select, Toggle, NumberInput } from '../ui/index.js';
import { Building2 } from 'lucide-react';

export interface CreateHostelModalProps {
  isOpen: boolean;
  onClose: () => void;
  userWing?: 'boys' | 'girls' | null;
  onSuccess: () => void;
}

export const CreateHostelModal: React.FC<CreateHostelModalProps> = ({
  isOpen,
  onClose,
  userWing,
  onSuccess
}) => {
  const { showSuccess, showError } = useConfirm();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    code: '',
    category: (userWing as 'boys' | 'girls') || 'boys',
    campus: 'Main Campus, Rajahmundry',
    autoGenRooms: true,
    numFloors: 3 as number | string,
    roomsPerFloor: 10 as number | string,
    bedsPerRoom: 3 as number | string
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await apiRequest<{ success: boolean; data: any; message?: string }>('/hostels', {
        method: 'POST',
        body: {
          ...form,
          initRooms: form.autoGenRooms ? {
            numFloors: Number(form.numFloors) || 3,
            roomsPerFloor: Number(form.roomsPerFloor) || 10,
            bedsPerRoom: Number(form.bedsPerRoom) || 3
          } : undefined
        }
      });
      if (res.success) {
        await showSuccess(res.message || 'Hostel created successfully');
        onSuccess();
        onClose();
        // Reset form
        setForm({
          name: '',
          code: '',
          category: (userWing as 'boys' | 'girls') || 'boys',
          campus: 'Main Campus, Rajahmundry',
          autoGenRooms: true,
          numFloors: 3,
          roomsPerFloor: 10,
          bedsPerRoom: 3
        });
      }
    } catch (err: any) {
      await showError('Failed to create hostel: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New University Hostel"
      size="lg"
      icon={<Building2 className="w-5 h-5 text-[#92582F]" />}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            required
            label="Hostel Name"
            placeholder="e.g. University Hostel 1"
            value={form.name}
            onChange={(e) => {
              const name = e.target.value;
              const autoCode = name.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 4) || 'BH-1';
              const isGirls = /girl|women|ladies|\bgh\b/i.test(name);
              setForm((prev) => ({
                ...prev,
                name,
                code: prev.code || autoCode,
                category: isGirls ? 'girls' : prev.category
              }));
            }}
          />

          <Input
            required
            label="Hostel Short Code"
            placeholder="e.g. BH-1 or GH-1"
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

        {/* Room Generation Configuration */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-md p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <Toggle
              checked={form.autoGenRooms}
              onChange={(val) => setForm({ ...form, autoGenRooms: val })}
              label="Auto-Generate Starting Rooms & Beds"
              description="Creates blocks, floors, and bed capacity immediately"
            />
          </div>

          {form.autoGenRooms && (
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <NumberInput
                label="Floors"
                min={1}
                max={10}
                value={form.numFloors}
                onChange={(val) => setForm((prev) => ({ ...prev, numFloors: val }))}
              />
              <NumberInput
                label="Rooms/Floor"
                min={1}
                max={30}
                value={form.roomsPerFloor}
                onChange={(val) => setForm((prev) => ({ ...prev, roomsPerFloor: val }))}
              />
              <NumberInput
                label="Beds/Room"
                min={1}
                max={6}
                value={form.bedsPerRoom}
                onChange={(val) => setForm((prev) => ({ ...prev, bedsPerRoom: val }))}
              />
              <div className="col-span-3 text-[11px] text-[#92582F] font-semibold bg-amber-50/60 p-2 rounded border border-amber-200/50">
                Total starting capacity:{' '}
                {(Number(form.numFloors) || 0) * (Number(form.roomsPerFloor) || 0) * (Number(form.bedsPerRoom) || 0)} beds (
                {(Number(form.numFloors) || 0) * (Number(form.roomsPerFloor) || 0)} rooms across{' '}
                {Number(form.numFloors) || 0} floor{Number(form.numFloors) === 1 ? '' : 's'})
              </div>
            </div>
          )}
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
            variant="accent"
            disabled={submitting}
          >
            {submitting ? 'Creating...' : 'Create Hostel'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
