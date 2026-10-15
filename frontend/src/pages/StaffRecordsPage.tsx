import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { useConfirm } from '../context/ConfirmContext.js';
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  Search,
  Filter,
  CheckCircle,
  Building,
  Phone,
  Mail,
  Trash2,
  Pencil,
  Lock,
  Info,
  X
} from 'lucide-react';
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

interface StaffMember {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: string;
  role_display: string;
  hostel_id?: string;
  hostel_name?: string;
  hostel_code?: string;
  isRecordOnly: boolean;
  accessType: string;
  is_active?: boolean;
  created_at: string;
}

interface HostelOption {
  id: string;
  name: string;
  code: string;
}

export const StaffRecordsPage: React.FC = () => {
  const { user } = useAuth();
  const { confirm, showSuccess, showError } = useConfirm();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [hostels, setHostels] = useState<HostelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Add staff modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('mess_staff');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [hostelId, setHostelId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Edit staff modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState('mess_staff');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editHostelId, setEditHostelId] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; data: StaffMember[] }>('/staff');
      if (res.success) {
        setStaff(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load staff records');
    } finally {
      setLoading(false);
    }
  };

  const fetchHostels = async () => {
    try {
      const res = await apiRequest<{ success: boolean; data: HostelOption[] }>('/hostels');
      if (res.success) {
        setHostels(res.data);
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchStaff();
    fetchHostels();
  }, []);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError('');
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/staff', {
        method: 'POST',
        body: {
          fullName,
          role,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          hostelId: hostelId || undefined
        }
      });
      if (res.success) {
        setSuccessMsg(res.message);
        setShowAddModal(false);
        setFullName('');
        setEmail('');
        setPhone('');
        setHostelId('');
        await fetchStaff();
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to add staff record');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    const confirmed = await confirm({
      title: 'Remove Staff Record',
      message: `Are you sure you want to remove ${name} from staff records? Their administrative credentials and privileges will be terminated.`,
      confirmText: 'Remove Staff',
      variant: 'danger'
    });
    if (!confirmed) return;
    try {
      await apiRequest(`/staff/${id}`, { method: 'DELETE' });
      await showSuccess(`Staff record for ${name} removed.`, 'Staff Removed');
      fetchStaff();
    } catch (err: any) {
      await showError(err.message || 'Failed to delete staff record');
    }
  };

  const handleOpenEditStaff = (member: StaffMember) => {
    setEditingStaff(member);
    setEditFullName(member.full_name || '');
    setEditRole(member.role || 'mess_staff');
    setEditEmail(member.email || '');
    setEditPhone(member.phone || '');
    setEditHostelId(member.hostel_id || '');
    setEditIsActive(member.is_active ?? true);
    setEditError('');
    setShowEditModal(true);
  };

  const handleSaveEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setEditSubmitting(true);
    setEditError('');
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(`/staff/${editingStaff.id}`, {
        method: 'PUT',
        body: {
          fullName: editFullName.trim(),
          role: editRole,
          email: editEmail.trim(),
          phone: editPhone.trim(),
          hostelId: editHostelId || null,
          isActive: editIsActive
        }
      });
      if (res.success) {
        setSuccessMsg(res.message);
        setShowEditModal(false);
        setEditingStaff(null);
        fetchStaff();
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      setEditError(err.message || 'Failed to update staff record');
    } finally {
      setEditSubmitting(false);
    }
  };

  const filteredStaff = staff.filter((s) => {
    if (s.role === 'super_admin') return false;

    const matchesSearch =
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.phone && s.phone.includes(searchQuery));

    if (!matchesSearch) return false;

    if (roleFilter === 'RECORD_ONLY') return s.isRecordOnly;
    if (roleFilter === 'ACTIVE_LOGIN') return !s.isRecordOnly;
    if (roleFilter !== 'ALL') return s.role === roleFilter;

    return true;
  });

  const recordOnlyCount = staff.filter((s) => s.role !== 'super_admin' && s.isRecordOnly).length;
  const activeLoginCount = staff.filter((s) => s.role !== 'super_admin' && !s.isRecordOnly).length;

  return (
    <div className="space-y-3">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-md bg-[#E8EDF5] text-[#23395D] flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">University Staff Personnel Directory</h1>
              <p className="text-xs text-slate-500">
                Staff records maintained for university administration. Record-only staff do not have system login access.
              </p>
            </div>
          </div>
        </div>

        {['super_admin', 'chief_warden', 'hostel_warden'].includes(user?.role || '') && (
          <Button
            onClick={() => setShowAddModal(true)}
            leftIcon={<UserPlus className="w-4 h-4" />}
            variant="primary"
          >
            Add Staff Record
          </Button>
        )}
      </div>

      {/* Alert Messages */}
      {successMsg && (
        <div className="p-3.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-md bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 block">Total Registered Staff</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-800">{staff.length}</span>
            <span className="text-xs font-bold text-slate-500">Personnel</span>
          </div>
        </div>

        <div className="bg-amber-50/70 p-5 rounded-lg border border-amber-200/80 shadow-sm">
          <div className="flex items-center space-x-1.5 text-amber-800">
            <Lock className="w-4 h-4" />
            <span className="text-xs font-bold">Record-Only Staff (No Login)</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-900">{recordOnlyCount}</span>
            <span className="text-[11px] font-semibold text-amber-700">Mess, Security, Maint, Accts, Mgmt</span>
          </div>
        </div>

        <div className="bg-blue-50/70 p-5 rounded-lg border border-blue-200/80 shadow-sm">
          <div className="flex items-center space-x-1.5 text-blue-800">
            <Shield className="w-4 h-4" />
            <span className="text-xs font-bold">Active System Operators</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-blue-900">{activeLoginCount}</span>
            <span className="text-[11px] font-semibold text-blue-700">Admins, Wardens & Mess Mgrs</span>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="w-full md:w-80">
          <Input
            placeholder="Search by name, phone, or email..."
            leftIcon={<Search className="w-4 h-4" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="w-full md:w-72">
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            options={[
              { value: 'ALL', label: `All Staff Categories (${staff.length})` },
              { value: 'RECORD_ONLY', label: `Record-Only Personnel (${recordOnlyCount})` },
              { value: 'ACTIVE_LOGIN', label: `Active System Operators (${activeLoginCount})` },
              { value: 'mess_staff', label: 'Mess Staff' },
              { value: 'security_staff', label: 'Security Staff' },
              { value: 'maint_staff', label: 'Maintenance Staff' },
              { value: 'accounts_staff', label: 'Accounts Staff' },
              { value: 'univ_mgmt', label: 'University Management' },
              { value: 'hostel_warden', label: 'Hostel Wardens' },
              { value: 'chief_warden', label: 'Chief Warden' },
              { value: 'mess_manager', label: 'Mess Manager' }
            ]}
          />
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead>Assigned Role</TableHead>
                <TableHead>System Access Status</TableHead>
                <TableHead>Hostel / Campus Assignment</TableHead>
                <TableHead>Contact Phone</TableHead>
                <TableHead align="right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableLoading colSpan={6} message="Loading staff records..." />
              ) : filteredStaff.length === 0 ? (
                <TableEmpty colSpan={6} message="No staff records found matching your filters." />
              ) : (
                filteredStaff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                            member.isRecordOnly
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {member.full_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{member.full_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
                            <Mail className="w-3 h-3" />
                            <span>{member.email}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="font-semibold text-slate-700">{member.role_display}</span>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={member.isRecordOnly ? 'warning' : 'success'}
                      >
                        {member.isRecordOnly ? 'Record Only (No Login)' : 'Active Login Access'}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {member.hostel_name ? (
                        <div className="flex items-center space-x-1.5 font-medium text-slate-600">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          <span>{member.hostel_name} ({member.hostel_code})</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Central / Campus-wide</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {member.phone ? (
                        <div className="flex items-center space-x-1 text-slate-600 font-mono">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{member.phone}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>

                    <TableCell align="right">
                      <div className="flex items-center justify-end space-x-1">
                        {['super_admin', 'chief_warden'].includes(user?.role || '') && member.role !== 'super_admin' && (
                          <>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => handleOpenEditStaff(member)}
                              title="Edit staff details"
                              className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                            >
                              <Pencil className="w-4 h-4 text-indigo-600" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => handleDeleteStaff(member.id, member.full_name)}
                              title="Remove from staff records"
                              className="text-slate-600 hover:text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="w-4 h-4 text-rose-500" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add Staff Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add University Staff Member"
        size="lg"
        icon={<UserPlus className="w-5 h-5 text-amber-500" />}
      >
        <form onSubmit={handleAddStaff} className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-[11px] text-amber-800 flex items-start space-x-2">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>
              Staff added under <strong>Mess Staff, Security, Maintenance, Accounts, or Mgmt</strong> are saved strictly for university records and will <strong>not</strong> have portal login access.
            </span>
          </div>

          {modalError && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
              {modalError}
            </div>
          )}

          <Input
            required
            label="Full Name *"
            placeholder="e.g. Mr. K. Prasad"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Staff Role *"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <optgroup label="Record-Only (No Login Access)">
                <option value="mess_staff">Mess Staff</option>
                <option value="security_staff">Security Staff</option>
                <option value="maint_staff">Maintenance Staff</option>
                <option value="accounts_staff">Accounts Staff</option>
                <option value="univ_mgmt">University Management</option>
              </optgroup>
              <optgroup label="Active System Operators">
                <option value="hostel_warden">Hostel Warden</option>
                <option value="mess_manager">Mess Manager</option>
              </optgroup>
            </Select>

            <Select
              label="Hostel Assignment"
              value={hostelId}
              onChange={(e) => setHostelId(e.target.value)}
              options={[
                { value: '', label: 'Campus-wide / None' },
                ...hostels.map((h) => ({
                  value: h.id,
                  label: `${h.name} (${h.code})`
                }))
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Contact Phone"
              type="tel"
              placeholder="98480xxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <Input
              label="University Email (Optional)"
              type="email"
              placeholder="Auto-generated if empty"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={submitting}
            >
              Save Staff Record
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Staff Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingStaff(null);
        }}
        title={`Edit Staff Record: ${editingStaff?.full_name || ''}`}
        size="lg"
        icon={<Pencil className="w-5 h-5 text-indigo-600" />}
      >
        <form onSubmit={handleSaveEditStaff} className="space-y-4">
          {editError && (
            <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          <Input
            label="Full Legal Name *"
            required
            placeholder="e.g. Dr. K. Ramanayya"
            value={editFullName}
            onChange={(e) => setEditFullName(e.target.value)}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="Staff Position & Role *"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              options={[
                { value: 'mess_staff', label: 'Mess Staff (Record Only)' },
                { value: 'security_staff', label: 'Security Staff (Record Only)' },
                { value: 'maint_staff', label: 'Maintenance Staff (Record Only)' },
                { value: 'accounts_staff', label: 'Accounts Staff (Record Only)' },
                { value: 'univ_mgmt', label: 'University Management (Record Only)' },
                { value: 'hostel_warden', label: 'Hostel Warden (Active Login)' },
                { value: 'chief_warden', label: 'Chief Warden (Active Login)' },
                { value: 'mess_manager', label: 'Mess Manager (Active Login)' }
              ]}
            />

            <Select
              label="Assigned Hostel / Wing"
              value={editHostelId}
              onChange={(e) => setEditHostelId(e.target.value)}
              options={[
                { value: '', label: 'None / Campus-Wide' },
                ...hostels.map((h) => ({
                  value: h.id,
                  label: `${h.name} (${h.code})`
                }))
              ]}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Contact Phone"
              placeholder="98480xxxxx"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
            />

            <Input
              label="University Email"
              type="email"
              placeholder="staff@aknu.edu.in"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="Account Status"
              value={editIsActive ? 'true' : 'false'}
              onChange={(e) => setEditIsActive(e.target.value === 'true')}
              options={[
                { value: 'true', label: 'Active Personnel' },
                { value: 'false', label: 'Deactivated / Relieved' }
              ]}
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowEditModal(false);
                setEditingStaff(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={editSubmitting}
            >
              Update Staff Record
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
