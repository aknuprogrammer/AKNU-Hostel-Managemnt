import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../services/api.js';
import { LeaveApplication } from '../types.js';
import { useConfirm } from '../context/ConfirmContext.js';
import { CalendarCheck, ShieldCheck, Plus, CheckCircle, XCircle, ArrowRight, Clock, UserCheck } from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Textarea,
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

export const LeavePage: React.FC = () => {
  const { user } = useAuth();
  const { confirm, showSuccess, showError, showWarning } = useConfirm();
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);

  // New application state
  const [newLeave, setNewLeave] = useState({
    leaveType: 'home',
    departureDate: '',
    returnDate: '',
    destination: '',
    reason: '',
    guardianPhone: ''
  });

  // Security Gate Verifier
  const [searchPassCode, setSearchPassCode] = useState('');
  const [verifiedPass, setVerifiedPass] = useState<any | null>(null);
  const [movementNotes, setMovementNotes] = useState('');

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ success: boolean; data: LeaveApplication[] }>('/leave');
      if (res.success) {
        setLeaves(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/leave/apply', {
        method: 'POST',
        body: newLeave
      });
      if (res.success) {
        await showSuccess(res.message, 'Leave Applied');
        setShowApplyModal(false);
        fetchLeaves();
      }
    } catch (err: any) {
      await showError('Application failed: ' + err.message);
    }
  };

  const handleUpdateStatus = async (leaveId: string, status: 'approved' | 'rejected') => {
    const isApproved = status === 'approved';
    const confirmed = await confirm({
      title: isApproved ? 'Approve Outing / Leave' : 'Reject Outing / Leave',
      message: isApproved
        ? 'Are you sure you want to approve this student leave request and issue their digital gate pass?'
        : 'Are you sure you want to decline this leave application? The student will be notified accordingly.',
      confirmText: isApproved ? 'Approve Leave' : 'Reject Leave',
      variant: isApproved ? 'success' : 'danger'
    });
    if (!confirmed) return;

    const rejectionReason = status === 'rejected' ? 'Policy restrictions / Warden review' : '';

    try {
      const res = await apiRequest<{ success: boolean; message: string }>(`/leave/${leaveId}/status`, {
        method: 'PATCH',
        body: { status, rejectionReason }
      });
      if (res.success) {
        await showSuccess(res.message, isApproved ? 'Leave Approved' : 'Leave Declined');
        fetchLeaves();
      }
    } catch (e: any) {
      await showError('Failed: ' + e.message);
    }
  };

  const handleVerifyGatePass = async () => {
    if (!searchPassCode) return;
    try {
      const res = await apiRequest<{ success: boolean; data: any }>(`/leave/gate-pass/${searchPassCode.trim()}`);
      if (res.success) {
        setVerifiedPass(res.data);
      }
    } catch (e: any) {
      await showError('Pass verification error: ' + e.message, 'Invalid Gate Pass');
      setVerifiedPass(null);
    }
  };

  const handleLogMovement = async (type: 'EXIT' | 'ENTRY') => {
    if (!verifiedPass) return;
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/leave/gate-movements', {
        method: 'POST',
        body: {
          gatePassId: verifiedPass.pass.id,
          studentId: verifiedPass.pass.student_id,
          movementType: type,
          notes: movementNotes
        }
      });
      if (res.success) {
        await showSuccess(res.message, type === 'EXIT' ? 'Gate Exit Logged' : 'Gate Return Logged');
        handleVerifyGatePass();
        fetchLeaves();
      }
    } catch (e: any) {
      await showError('Movement logging error: ' + e.message);
    }
  };

  const role = user?.role || 'student';
  const isSecurity = ['super_admin', 'junior_assistant', 'chief_warden', 'assistant_warden'].includes(role);
  const isWarden = ['super_admin', 'chief_warden', 'assistant_warden'].includes(role);

  return (
    <div className="space-y-3">
      {/* Top Header */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Leave Applications & Digital Gate Passes</h1>
          <p className="text-xs text-slate-500 mt-1">
            Student out-pass workflows, warden digital approval, and Main Gate checkpoint verification.
          </p>
        </div>

        {role === 'student' && (
          <Button
            onClick={() => setShowApplyModal(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            variant="primary"
          >
            Apply For Hostel Leave
          </Button>
        )}
      </div>

      {/* Security Staff Gate Pass Scanner Tool */}
      {isSecurity && (
        <div className="bg-slate-900 rounded-lg p-6 text-white border border-slate-800 shadow-lg space-y-4">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm">Security Staff Gate Pass Verification Console</h3>
          </div>

          <div className="flex gap-2 max-w-md items-center">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Enter Pass Code (e.g. GP-101234)"
                value={searchPassCode}
                onChange={(e) => setSearchPassCode(e.target.value.toUpperCase())}
                className="font-mono uppercase"
              />
            </div>
            <Button
              onClick={handleVerifyGatePass}
              variant="accent"
              size="md"
            >
              Verify Pass
            </Button>
          </div>

          {verifiedPass && (
            <div className="p-4 rounded-md bg-slate-800/80 border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in">
              <div className="flex items-center space-x-3">
                <img
                  src={verifiedPass.pass.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
                  alt=""
                  className="w-12 h-12 rounded-md object-cover border border-slate-600"
                />
                <div>
                  <h4 className="font-bold text-white text-sm">{verifiedPass.pass.student_name}</h4>
                  <span className="font-mono text-xs text-amber-300 font-bold block">{verifiedPass.pass.roll_number}</span>
                  <p className="text-[11px] text-slate-400">
                    Destination: {verifiedPass.pass.destination} • Valid: {new Date(verifiedPass.pass.valid_from).toLocaleDateString()} to {new Date(verifiedPass.pass.valid_to).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => handleLogMovement('EXIT')}
                  variant="danger"
                  size="sm"
                >
                  Confirm Exit
                </Button>
                <Button
                  onClick={() => handleLogMovement('ENTRY')}
                  variant="success"
                  size="sm"
                >
                  Confirm Entry
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Leave Applications List */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-800">Submitted Out-Pass Records</h3>
          <span className="text-xs text-slate-400 font-mono">{leaves.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Departure & Return</TableHead>
                <TableHead>Destination & Reason</TableHead>
                <TableHead>Status & Gate Pass</TableHead>
                {isWarden && <TableHead align="right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableLoading colSpan={isWarden ? 5 : 4} message="Loading leave requests..." />
              ) : leaves.length > 0 ? (
                leaves.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <span className="font-bold text-slate-800 block text-sm">{l.student_name}</span>
                      <span className="font-mono text-slate-500 block">{l.roll_number} • {l.hostel_name || 'Hostel'}</span>
                    </TableCell>

                    <TableCell>
                      <span className="text-slate-800 font-semibold block">
                        Depart: {new Date(l.departure_date).toLocaleDateString()}
                      </span>
                      <span className="text-slate-500 block">
                        Return: {new Date(l.return_date).toLocaleDateString()}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="font-semibold text-slate-800 block">{l.destination}</span>
                      <span className="text-slate-500 block text-[11px] max-w-xs">{l.reason}</span>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            l.status === 'approved'
                              ? 'success'
                              : l.status === 'rejected'
                              ? 'danger'
                              : 'warning'
                          }
                          dot
                        >
                          {l.status}
                        </Badge>
                        {l.pass_code && (
                          <Badge variant="primary">
                            {l.pass_code}
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {isWarden && (
                      <TableCell align="right">
                        {l.status === 'submitted' ? (
                          <div className="flex items-center justify-end space-x-1.5">
                            <Button
                              onClick={() => handleUpdateStatus(l.id, 'approved')}
                              variant="success"
                              size="xs"
                            >
                              Approve
                            </Button>
                            <Button
                              onClick={() => handleUpdateStatus(l.id, 'rejected')}
                              variant="danger"
                              size="xs"
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Processed</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableEmpty colSpan={isWarden ? 5 : 4} message="No leave applications found." />
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* MODAL: SUBMIT LEAVE APPLICATION */}
      <Modal
        isOpen={showApplyModal}
        onClose={() => setShowApplyModal(false)}
        title="Submit Hostel Leave Application"
        size="md"
        icon={<CalendarCheck className="w-5 h-5 text-amber-500" />}
      >
        <form onSubmit={handleApplyLeave} className="space-y-3.5">
          <Select
            label="Leave Category"
            value={newLeave.leaveType}
            onChange={(e) => setNewLeave({ ...newLeave, leaveType: e.target.value })}
            options={[
              { value: 'home', label: 'Home Visit' },
              { value: 'medical', label: 'Medical / Hospital' },
              { value: 'academic', label: 'Academic / Exam / Seminar' },
              { value: 'emergency', label: 'Emergency' }
            ]}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              required
              label="Departure Date & Time *"
              type="datetime-local"
              value={newLeave.departureDate}
              onChange={(e) => setNewLeave({ ...newLeave, departureDate: e.target.value })}
            />
            <Input
              required
              label="Expected Return Date *"
              type="datetime-local"
              value={newLeave.returnDate}
              onChange={(e) => setNewLeave({ ...newLeave, returnDate: e.target.value })}
            />
          </div>

          <Input
            required
            label="Destination Address / City *"
            type="text"
            placeholder="e.g. Vijayawada, Andhra Pradesh"
            value={newLeave.destination}
            onChange={(e) => setNewLeave({ ...newLeave, destination: e.target.value })}
          />

          <Textarea
            required
            label="Reason for Leave *"
            rows={2}
            placeholder="Explain reason in detail"
            value={newLeave.reason}
            onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
          />

          <Input
            label="Guardian Phone (For Verification)"
            type="tel"
            placeholder="Parent / Guardian phone number"
            value={newLeave.guardianPhone}
            onChange={(e) => setNewLeave({ ...newLeave, guardianPhone: e.target.value })}
          />

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowApplyModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              Submit For Warden Approval
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
