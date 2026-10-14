import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api.js';
import { Visitor } from '../types.js';
import { ShieldAlert, Plus, LogOut, CheckCircle2, UserCheck, Shield } from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Modal,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableLoading,
  TableEmpty
} from '../components/ui/index.js';

export const SecurityPage: React.FC = () => {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const [hostels, setHostels] = useState<any[]>([]);

  // New visitor form
  const [newVisitor, setNewVisitor] = useState({
    hostelId: '',
    studentRoll: '',
    visitorName: '',
    visitorPhone: '',
    relationToStudent: 'Parent',
    purpose: 'Personal Family Visit',
    idProofType: 'Aadhaar Card',
    idProofNumber: ''
  });

  useEffect(() => {
    fetchVisitors();
    fetchHostels();
  }, []);

  const fetchHostels = async () => {
    try {
      const res = await apiRequest<{ success: boolean; data: any[] }>('/hostels');
      if (res.success) {
        setHostels(res.data);
        if (res.data.length > 0) {
          setNewVisitor((prev) => ({ ...prev, hostelId: prev.hostelId || res.data[0].id }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchVisitors = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ success: boolean; data: Visitor[] }>('/visitors');
      if (res.success) {
        setVisitors(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterVisitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVisitor.studentRoll.trim()) {
      alert('Please enter student roll number');
      return;
    }
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/visitors/register', {
        method: 'POST',
        body: newVisitor
      });
      if (res.success) {
        alert(res.message);
        setShowRegisterModal(false);
        setNewVisitor({
          hostelId: hostels[0]?.id || '',
          studentRoll: '',
          visitorName: '',
          visitorPhone: '',
          relationToStudent: 'Parent',
          purpose: 'Personal Family Visit',
          idProofType: 'Aadhaar Card',
          idProofNumber: ''
        });
        fetchVisitors();
      }
    } catch (err: any) {
      alert('Error registering visitor: ' + err.message);
    }
  };

  const handleCheckout = async (visitorId: string) => {
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(`/visitors/${visitorId}/checkout`, {
        method: 'PATCH'
      });
      if (res.success) {
        fetchVisitors();
      }
    } catch (err: any) {
      alert('Failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-3">
      {/* Top Header */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Security & Hostel Visitor Logbook</h1>
          <p className="text-xs text-slate-500 mt-1">
            Main Gate and Hostel reception check-in, identity verification, and checkout logs.
          </p>
        </div>

        <Button
          onClick={() => setShowRegisterModal(true)}
          leftIcon={<Plus className="w-4 h-4" />}
          variant="primary"
        >
          Register New Visitor
        </Button>
      </div>

      {/* Visitors Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-800">Campus Visitor Records</h3>
          <span className="text-xs text-slate-400 font-mono">{visitors.length} visitors</span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Visitor Name & Phone</TableHead>
                <TableHead>Visiting Student</TableHead>
                <TableHead>Hostel & Relation</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Check-In / Out Times</TableHead>
                <TableHead>Status</TableHead>
                <TableHead align="right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableLoading colSpan={7} message="Loading visitor records..." />
              ) : visitors.length > 0 ? (
                visitors.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <span className="font-bold text-slate-800 text-sm block">{v.visitor_name}</span>
                      <span className="font-mono text-slate-500 text-xs block">{v.visitor_phone}</span>
                    </TableCell>

                    <TableCell>
                      <span className="font-bold text-slate-800 block">{v.student_name}</span>
                      <span className="font-mono text-slate-400 text-xs block">{v.roll_number}</span>
                    </TableCell>

                    <TableCell>
                      <span className="font-semibold text-slate-700 block">{v.hostel_name}</span>
                      <span className="text-slate-500 block text-[11px]">{v.relation_to_student}</span>
                    </TableCell>

                    <TableCell>
                      <span className="text-slate-700 max-w-xs block">{v.purpose}</span>
                    </TableCell>

                    <TableCell>
                      <span className="text-slate-800 font-semibold block">
                        In: {new Date(v.check_in_time).toLocaleTimeString('en-IN')}
                      </span>
                      {v.check_out_time && (
                        <span className="text-slate-500 block text-[11px]">
                          Out: {new Date(v.check_out_time).toLocaleTimeString('en-IN')}
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={v.status === 'checked_in' ? 'success' : 'neutral'}
                        dot={v.status === 'checked_in'}
                      >
                        {v.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>

                    <TableCell align="right">
                      {v.status === 'checked_in' ? (
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => handleCheckout(v.id)}
                        >
                          Check Out
                        </Button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Completed</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableEmpty colSpan={7} message="No visitor entries recorded." />
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* MODAL: REGISTER VISITOR */}
      <Modal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        title="Security Visitor Check-In"
        size="md"
        icon={<Shield className="w-5 h-5 text-amber-500" />}
      >
        <form onSubmit={handleRegisterVisitor} className="space-y-3.5">
          <Input
            required
            label="Visitor Full Name *"
            placeholder="e.g. S. Narayana Murthy"
            value={newVisitor.visitorName}
            onChange={(e) => setNewVisitor({ ...newVisitor, visitorName: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              required
              label="Visitor Phone *"
              placeholder="9848011222"
              value={newVisitor.visitorPhone}
              onChange={(e) => setNewVisitor({ ...newVisitor, visitorPhone: e.target.value })}
            />
            <Select
              label="Relation to Student"
              value={newVisitor.relationToStudent}
              onChange={(e) => setNewVisitor({ ...newVisitor, relationToStudent: e.target.value })}
              options={[
                { value: 'Father', label: 'Father' },
                { value: 'Mother', label: 'Mother' },
                { value: 'Guardian', label: 'Guardian' },
                { value: 'Sibling', label: 'Brother / Sister' },
                { value: 'Relative', label: 'Relative' },
                { value: 'Official', label: 'Official Guest' }
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              required
              label="Student Roll Number *"
              placeholder="e.g. 22CSE055"
              value={newVisitor.studentRoll}
              onChange={(e) => setNewVisitor({ ...newVisitor, studentRoll: e.target.value.toUpperCase() })}
              className="font-mono uppercase font-bold"
            />
            <Select
              label="Hostel Visited"
              value={newVisitor.hostelId}
              onChange={(e) => setNewVisitor({ ...newVisitor, hostelId: e.target.value })}
              options={[
                { value: '', label: '-- Auto-detect from Student --' },
                ...hostels.map((h) => ({
                  value: h.id,
                  label: `${h.name} (${h.code})`
                }))
              ]}
            />
          </div>

          <Input
            required
            label="Visit Purpose *"
            placeholder="e.g. Delivering books & home medicine"
            value={newVisitor.purpose}
            onChange={(e) => setNewVisitor({ ...newVisitor, purpose: e.target.value })}
          />

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowRegisterModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              Check In Visitor
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
