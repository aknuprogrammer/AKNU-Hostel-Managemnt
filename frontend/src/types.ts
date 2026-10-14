export type UserRole =
  | 'super_admin'
  | 'univ_mgmt'
  | 'chief_warden'
  | 'hostel_warden'
  | 'mess_manager'
  | 'mess_staff'
  | 'security_staff'
  | 'accounts_staff'
  | 'maint_staff'
  | 'student';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  roleDisplay: string;
  assignedHostels?: Array<{ id: string; name: string; code: string; category: string }>;
  assignedCategory?: 'boys' | 'girls' | 'all';
  student?: StudentProfile | null;
}

export interface StudentProfile {
  id: string;
  student_id_code: string;
  roll_number: string;
  reg_number: string;
  full_name: string;
  photo_url?: string;
  gender: string;
  dob?: string;
  department_id?: string;
  department_name?: string;
  course_id?: string;
  course_name?: string;
  year_of_study?: number;
  current_semester?: number;
  phone: string;
  email: string;
  permanent_address?: string;
  guardian_name?: string;
  guardian_phone?: string;
  hostel_status: string;
  mess_eligibility: boolean;
  meal_eligibility_start?: string;
  meal_eligibility_end?: string;
  qr_credential_token: string;
  qr_status: string;
  hostel_name?: string;
  hostel_id?: string;
  room_number?: string;
  bed_number?: string;
  allocation_id?: string;
  qrDataUri?: string;
}

export interface Hostel {
  id: string;
  name: string;
  code: string;
  category: 'boys' | 'girls';
  campus: string;
  total_capacity: number;
  status: string;
  total_rooms?: number;
  total_beds?: number;
  occupied_beds?: number;
  chief_warden_name?: string;
}

export interface MealSession {
  id: string;
  name: string;
  code: string;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  is_active: boolean;
  remainingMinutes?: number;
}

export interface MealScanResult {
  success: boolean;
  resultStatus: 'SUCCESS' | 'DUPLICATE' | 'OUTSIDE_HOURS' | 'NOT_ELIGIBLE' | 'HOSTEL_MISMATCH' | 'INVALID_CREDENTIAL';
  title: string;
  message: string;
  transaction?: {
    id: string;
    scannedAt: string;
    sessionName: string;
    checkpoint: string;
  };
  student?: {
    id?: string;
    fullName: string;
    rollNumber: string;
    regNumber?: string;
    photoUrl?: string;
    hostelName?: string;
    roomNumber?: string;
    bedNumber?: string;
  };
}

export interface LeaveApplication {
  id: string;
  student_id: string;
  student_name: string;
  roll_number: string;
  photo_url?: string;
  hostel_name?: string;
  room_number?: string;
  leave_type: string;
  departure_date: string;
  return_date: string;
  destination: string;
  reason: string;
  guardian_phone?: string;
  status: 'submitted' | 'approved' | 'rejected' | 'escalated';
  rejection_reason?: string;
  gate_pass_id?: string;
  pass_code?: string;
  gate_pass_status?: string;
  created_at: string;
}

export interface Complaint {
  id: string;
  complaint_number: string;
  student_id: string;
  student_name: string;
  roll_number: string;
  student_phone?: string;
  hostel_id: string;
  hostel_name: string;
  room_number?: string;
  category: string;
  description: string;
  image_urls?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'submitted' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  assigned_to_name?: string;
  resolution_notes?: string;
  student_rating?: number;
  student_feedback?: string;
  created_at: string;
}

export interface MessMenu {
  id: string;
  hostel_id: string;
  day_of_week: string;
  meal_session_id: string;
  session_name: string;
  session_code: string;
  start_time: string;
  end_time: string;
  menu_items: string;
  is_special: boolean;
}

export interface InventoryItem {
  id: string;
  hostel_id: string;
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  min_stock_threshold: number;
  is_low_stock: boolean;
  last_restocked_at: string;
}

export interface FeeLedger {
  id: string;
  student_id: string;
  student_name: string;
  roll_number: string;
  student_phone?: string;
  fee_type: string;
  total_prescribed_amount: number;
  amount_due: number;
  amount_paid: number;
  balance: number;
  status: 'paid' | 'partial' | 'unpaid' | 'exempted';
  due_date: string;
  hostel_name: string;
}

export interface Visitor {
  id: string;
  hostel_id: string;
  hostel_name: string;
  student_id: string;
  student_name: string;
  roll_number: string;
  visitor_name: string;
  visitor_phone: string;
  relation_to_student: string;
  purpose: string;
  id_proof_type: string;
  id_proof_number?: string;
  check_in_time: string;
  check_out_time?: string;
  security_officer_name: string;
  status: 'checked_in' | 'checked_out';
}
