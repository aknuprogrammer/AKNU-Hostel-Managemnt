import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../services/api.js';
import { Complaint } from '../types.js';
import { useConfirm } from '../context/ConfirmContext.js';
import { AlertCircle, Plus, CheckCircle2, Star, Clock, Wrench } from 'lucide-react';
import {
  Button,
  Select,
  Textarea,
  Modal,
  Badge,
  Card
} from '../components/ui/index.js';

export const ComplaintsPage: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useConfirm();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New complaint form
  const [newComplaint, setNewComplaint] = useState({
    category: 'water',
    description: '',
    priority: 'medium'
  });

  // Rating modal
  const [ratingComplaint, setRatingComplaint] = useState<Complaint | null>(null);
  const [starCount, setStarCount] = useState(5);
  const [feedbackText, setFeedbackText] = useState('');

  // Status update modal
  const [updatingComplaint, setUpdatingComplaint] = useState<Complaint | null>(null);
  const [newStatus, setNewStatus] = useState('in_progress');
  const [resolutionNotes, setResolutionNotes] = useState('');

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ success: boolean; data: Complaint[] }>('/complaints');
      if (res.success) {
        setComplaints(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/complaints', {
        method: 'POST',
        body: newComplaint
      });
      if (res.success) {
        await showSuccess(res.message, 'Complaint Lodged');
        setShowCreateModal(false);
        setNewComplaint({ category: 'water', description: '', priority: 'medium' });
        fetchComplaints();
      }
    } catch (err: any) {
      await showError('Error lodging complaint: ' + err.message);
    }
  };

  const handleUpdateStatus = async () => {
    if (!updatingComplaint) return;
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(`/complaints/${updatingComplaint.id}/status`, {
        method: 'PATCH',
        body: { status: newStatus, resolutionNotes }
      });
      if (res.success) {
        await showSuccess(res.message, 'Status Updated');
        setUpdatingComplaint(null);
        fetchComplaints();
      }
    } catch (err: any) {
      await showError('Failed to update status: ' + err.message);
    }
  };

  const handleRate = async () => {
    if (!ratingComplaint) return;
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(`/complaints/${ratingComplaint.id}/rate`, {
        method: 'POST',
        body: { rating: starCount, feedback: feedbackText }
      });
      if (res.success) {
        await showSuccess(res.message, 'Feedback Submitted');
        setRatingComplaint(null);
        fetchComplaints();
      }
    } catch (err: any) {
      await showError('Rating submission failed: ' + err.message);
    }
  };

  const role = user?.role || 'student';
  const canManage = ['super_admin', 'chief_warden', 'hostel_warden', 'maint_staff'].includes(role);

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'danger';
      case 'high':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return 'success';
      case 'in_progress':
        return 'primary';
      default:
        return 'warning';
    }
  };

  return (
    <div className="space-y-3">
      {/* Top Header */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Complaints & Maintenance Work Orders</h1>
          <p className="text-xs text-slate-500 mt-1">
            Plumbing, electricity, carpentry, internet, and food quality service tickets.
          </p>
        </div>

        {role === 'student' && (
          <Button
            onClick={() => setShowCreateModal(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            variant="primary"
          >
            Lodge New Complaint
          </Button>
        )}
      </div>

      {/* Complaints Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {loading ? (
          <div className="col-span-3 text-center py-12 text-slate-400 text-xs">Loading complaints...</div>
        ) : complaints.length > 0 ? (
          complaints.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-500">{c.complaint_number}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={getPriorityBadgeVariant(c.priority)}>
                      {c.priority}
                    </Badge>
                    <Badge variant={getStatusBadgeVariant(c.status)} dot>
                      {c.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>

                <div className="mt-2.5">
                  <span className="text-[10px] text-aknu-blue uppercase font-bold tracking-wider block">
                    {c.category.replace('_', ' ')}
                  </span>
                  <p className="text-sm font-semibold text-slate-800 mt-1 line-clamp-2">{c.description}</p>
                </div>

                <div className="mt-3 text-xs text-slate-500 space-y-0.5 border-t border-slate-100 pt-2.5">
                  <p className="font-medium text-slate-700">Resident: {c.student_name} ({c.roll_number})</p>
                  <p>{c.hostel_name} {c.room_number ? `• Rm ${c.room_number}` : ''}</p>
                  {c.resolution_notes && (
                    <p className="text-emerald-700 font-medium text-[11px] bg-emerald-50 p-1.5 rounded mt-1.5">
                      Remarks: {c.resolution_notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(c.created_at).toLocaleDateString()}
                </span>

                <div className="flex items-center space-x-2">
                  {canManage && (
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => {
                        setUpdatingComplaint(c);
                        setNewStatus(c.status);
                        setResolutionNotes(c.resolution_notes || '');
                      }}
                    >
                      Update Status
                    </Button>
                  )}

                  {role === 'student' && c.status === 'resolved' && !c.student_rating && (
                    <Button
                      size="xs"
                      variant="accent"
                      leftIcon={<Star className="w-3 h-3 fill-current" />}
                      onClick={() => setRatingComplaint(c)}
                    >
                      Rate Repair
                    </Button>
                  )}

                  {c.student_rating && (
                    <span className="flex items-center text-xs font-bold text-amber-500">
                      ★ {c.student_rating}/5
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-3 text-center py-12 text-slate-400 text-xs">
            No complaints currently recorded.
          </div>
        )}
      </div>

      {/* MODAL: SUBMIT COMPLAINT */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Lodge Maintenance Complaint"
        size="md"
        icon={<Wrench className="w-5 h-5 text-amber-500" />}
      >
        <form onSubmit={handleCreateComplaint} className="space-y-3.5">
          <Select
            label="Issue Category"
            value={newComplaint.category}
            onChange={(e) => setNewComplaint({ ...newComplaint, category: e.target.value })}
            options={[
              { value: 'water', label: 'Water Supply / Dispenser / Tap' },
              { value: 'electricity', label: 'Electricity / Fan / Lights / Switch' },
              { value: 'room_maintenance', label: 'Room Maintenance / Door / Window' },
              { value: 'furniture', label: 'Furniture / Bed / Study Table' },
              { value: 'cleanliness', label: 'Cleanliness & Waste Disposal' },
              { value: 'washroom', label: 'Washroom / Sanitation' },
              { value: 'internet', label: 'Wi-Fi & Internet' },
              { value: 'food_quality', label: 'Mess Food Quality & Hygiene' },
              { value: 'security', label: 'Security & Gate Access' },
              { value: 'other', label: 'Other Service' }
            ]}
          />

          <Select
            label="Urgency Priority"
            value={newComplaint.priority}
            onChange={(e) => setNewComplaint({ ...newComplaint, priority: e.target.value })}
            options={[
              { value: 'low', label: 'Low (General Check)' },
              { value: 'medium', label: 'Medium (Standard 24-48h)' },
              { value: 'high', label: 'High (Needs Attention Today)' },
              { value: 'urgent', label: 'Urgent (Immediate Safety / Outage)' }
            ]}
          />

          <Textarea
            required
            label="Issue Description *"
            rows={3}
            placeholder="Describe the problem, room location details, and when it started"
            value={newComplaint.description}
            onChange={(e) => setNewComplaint({ ...newComplaint, description: e.target.value })}
          />

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              Submit Ticket
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: UPDATE WORK ORDER STATUS */}
      <Modal
        isOpen={!!updatingComplaint}
        onClose={() => setUpdatingComplaint(null)}
        title="Update Work Order Status"
        size="md"
        icon={<AlertCircle className="w-5 h-5 text-amber-500" />}
      >
        {updatingComplaint && (
          <div className="space-y-3.5">
            <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-md border border-slate-200">
              Ticket: <strong className="text-slate-800">{updatingComplaint.complaint_number}</strong> — <span className="uppercase">{updatingComplaint.category}</span>
            </p>

            <Select
              label="Work Progress Status"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              options={[
                { value: 'assigned', label: 'Assigned to Staff' },
                { value: 'in_progress', label: 'In Progress / Work Ongoing' },
                { value: 'resolved', label: 'Resolved / Fixed' },
                { value: 'closed', label: 'Closed' }
              ]}
            />

            <Textarea
              label="Resolution Remarks"
              rows={2}
              placeholder="e.g. Capacitor replaced, tap valve serviced"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
            />

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setUpdatingComplaint(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleUpdateStatus}
              >
                Save Updates
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: STUDENT 5-STAR RATING */}
      <Modal
        isOpen={!!ratingComplaint}
        onClose={() => setRatingComplaint(null)}
        title="Rate Maintenance Quality"
        size="sm"
        icon={<Star className="w-5 h-5 text-amber-500" />}
      >
        {ratingComplaint && (
          <div className="space-y-4 text-center">
            <p className="text-xs text-slate-500">
              How satisfied are you with the resolution of ticket <strong className="text-slate-800">{ratingComplaint.complaint_number}</strong>?
            </p>

            <div className="flex justify-center space-x-2 py-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStarCount(s)}
                  className={`text-2xl transition transform hover:scale-125 ${
                    s <= starCount ? 'text-amber-400' : 'text-slate-300'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>

            <Textarea
              rows={2}
              placeholder="Optional remarks on maintenance service..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
            />

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRatingComplaint(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="accent"
                onClick={handleRate}
              >
                Submit Rating
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
