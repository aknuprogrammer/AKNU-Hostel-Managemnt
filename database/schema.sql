-- ============================================================================
-- ADIKAVI NANNAYA UNIVERSITY (AKNU) HOSTEL MANAGEMENT SYSTEM
-- Centralized PostgreSQL Production Schema
-- ============================================================================

-- Extensions (for PostgreSQL)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ROLES & USERS
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN DEFAULT TRUE,
    is_first_login BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. ACADEMIC STRUCTURE
CREATE TABLE IF NOT EXISTS departments (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
    id VARCHAR(50) PRIMARY KEY,
    department_id VARCHAR(50) NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    duration_years INT DEFAULT 2,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS academic_years (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. HOSTEL, BLOCKS, ROOMS & BEDS
CREATE TABLE IF NOT EXISTS hostels (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    category VARCHAR(20) NOT NULL CHECK (category IN ('boys', 'girls')),
    campus VARCHAR(255) DEFAULT 'Main Campus, Rajahmundry',
    total_capacity INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'closed')),
    chief_warden_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_hostel_assignments (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hostel_id VARCHAR(50) NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, hostel_id)
);

CREATE TABLE IF NOT EXISTS blocks (
    id VARCHAR(50) PRIMARY KEY,
    hostel_id VARCHAR(50) NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hostel_id, code)
);

CREATE TABLE IF NOT EXISTS floors (
    id VARCHAR(50) PRIMARY KEY,
    block_id VARCHAR(50) NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    floor_number INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(block_id, floor_number)
);

CREATE TABLE IF NOT EXISTS rooms (
    id VARCHAR(50) PRIMARY KEY,
    floor_id VARCHAR(50) NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    hostel_id VARCHAR(50) NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
    room_number VARCHAR(50) NOT NULL,
    room_type VARCHAR(50) DEFAULT 'double' CHECK (room_type IN ('single', 'double', 'triple', 'four_share', 'dormitory')),
    capacity INT NOT NULL DEFAULT 2,
    current_occupancy INT NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'reserved')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hostel_id, room_number)
);

CREATE TABLE IF NOT EXISTS beds (
    id VARCHAR(50) PRIMARY KEY,
    room_id VARCHAR(50) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    bed_number VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'vacant' CHECK (status IN ('vacant', 'occupied', 'reserved', 'maintenance')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(room_id, bed_number)
);

-- 4. STUDENTS
CREATE TABLE IF NOT EXISTS students (
    id VARCHAR(50) PRIMARY KEY,
    student_id_code VARCHAR(50) NOT NULL UNIQUE,
    roll_number VARCHAR(50) NOT NULL UNIQUE,
    reg_number VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    photo_url TEXT,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female', 'other')),
    dob DATE,
    department_id VARCHAR(50) REFERENCES departments(id) ON DELETE SET NULL,
    course_id VARCHAR(50) REFERENCES courses(id) ON DELETE SET NULL,
    academic_year_id VARCHAR(50) REFERENCES academic_years(id) ON DELETE SET NULL,
    year_of_study INT DEFAULT 1,
    current_semester INT DEFAULT 1,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    permanent_address TEXT,
    guardian_name VARCHAR(255),
    guardian_phone VARCHAR(20),
    emergency_contact VARCHAR(20),
    hostel_status VARCHAR(20) DEFAULT 'active' CHECK (hostel_status IN ('active', 'vacated', 'suspended')),
    mess_eligibility BOOLEAN DEFAULT TRUE,
    eligible_meal_sessions TEXT DEFAULT '["breakfast","lunch","snacks","dinner"]',
    meal_eligibility_start DATE,
    meal_eligibility_end DATE,
    qr_credential_token TEXT NOT NULL,
    qr_salt VARCHAR(64) NOT NULL,
    qr_status VARCHAR(20) DEFAULT 'active' CHECK (qr_status IN ('active', 'revoked')),
    user_id VARCHAR(50) UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. ROOM ALLOCATIONS & HISTORY
CREATE TABLE IF NOT EXISTS student_allocations (
    id VARCHAR(50) PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    hostel_id VARCHAR(50) NOT NULL REFERENCES hostels(id) ON DELETE RESTRICT,
    room_id VARCHAR(50) NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    bed_id VARCHAR(50) NOT NULL REFERENCES beds(id) ON DELETE RESTRICT,
    academic_year_id VARCHAR(50) REFERENCES academic_years(id) ON DELETE SET NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'transferred', 'checked_out')),
    created_by VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS allocation_history (
    id VARCHAR(50) PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    from_hostel_id VARCHAR(50) REFERENCES hostels(id),
    to_hostel_id VARCHAR(50) REFERENCES hostels(id),
    from_room_id VARCHAR(50) REFERENCES rooms(id),
    to_room_id VARCHAR(50) REFERENCES rooms(id),
    from_bed_id VARCHAR(50) REFERENCES beds(id),
    to_bed_id VARCHAR(50) REFERENCES beds(id),
    transfer_type VARCHAR(30) NOT NULL CHECK (transfer_type IN ('room_transfer', 'hostel_transfer', 'checkout')),
    transfer_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason TEXT NOT NULL,
    approved_by VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL
);

-- 6. MEAL SESSIONS & ATOMIC SCANNING ENGINE
CREATE TABLE IF NOT EXISTS meal_sessions (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(30) NOT NULL UNIQUE,
    start_time VARCHAR(10) NOT NULL,  -- e.g. "07:30"
    end_time VARCHAR(10) NOT NULL,    -- e.g. "09:30"
    grace_minutes INT DEFAULT 15,
    days_of_week TEXT DEFAULT '["mon","tue","wed","thu","fri","sat","sun"]',
    is_active BOOLEAN DEFAULT TRUE,
    allow_correction BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meal_transactions (
    id VARCHAR(50) PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    meal_session_id VARCHAR(50) NOT NULL REFERENCES meal_sessions(id) ON DELETE RESTRICT,
    hostel_id VARCHAR(50) NOT NULL REFERENCES hostels(id) ON DELETE RESTRICT,
    checkpoint_name VARCHAR(100) NOT NULL DEFAULT 'Main Dining Counter',
    service_date DATE NOT NULL,
    scanned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    scanned_by_user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(20) DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'REVERSED')),
    verification_method VARCHAR(30) DEFAULT 'QR_SCAN' CHECK (verification_method IN ('QR_SCAN', 'MANUAL_OVERRIDE')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- CRITICAL ATOMIC UNIQUE CONSTRAINT: Prevents double meal recording for the same student on the same day & session
    CONSTRAINT uq_meal_student_date_session UNIQUE (student_id, service_date, meal_session_id)
);

CREATE TABLE IF NOT EXISTS scan_attempts (
    id VARCHAR(50) PRIMARY KEY,
    student_id VARCHAR(50) REFERENCES students(id) ON DELETE SET NULL,
    roll_number VARCHAR(50),
    meal_session_id VARCHAR(50) REFERENCES meal_sessions(id) ON DELETE SET NULL,
    hostel_id VARCHAR(50) REFERENCES hostels(id) ON DELETE SET NULL,
    checkpoint_name VARCHAR(100),
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    scanned_by_user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    result_status VARCHAR(30) NOT NULL CHECK (result_status IN ('SUCCESS', 'DUPLICATE', 'OUTSIDE_HOURS', 'NOT_ELIGIBLE', 'HOSTEL_MISMATCH', 'INVALID_CREDENTIAL')),
    reason TEXT,
    raw_payload TEXT
);

CREATE TABLE IF NOT EXISTS meal_transaction_corrections (
    id VARCHAR(50) PRIMARY KEY,
    meal_transaction_id VARCHAR(50) NOT NULL REFERENCES meal_transactions(id) ON DELETE CASCADE,
    requested_by_user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by_user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    original_status VARCHAR(20) NOT NULL,
    new_status VARCHAR(20) NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. LEAVE APPLICATIONS, GATE PASSES & MOVEMENTS
CREATE TABLE IF NOT EXISTS leave_applications (
    id VARCHAR(50) PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    leave_type VARCHAR(30) NOT NULL CHECK (leave_type IN ('home', 'medical', 'academic', 'emergency', 'other')),
    departure_date TIMESTAMP NOT NULL,
    return_date TIMESTAMP NOT NULL,
    destination VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL,
    guardian_phone VARCHAR(20),
    guardian_consent_status VARCHAR(20) DEFAULT 'pending' CHECK (guardian_consent_status IN ('pending', 'consented', 'exempted')),
    status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected', 'escalated')),
    approved_by_user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gate_passes (
    id VARCHAR(50) PRIMARY KEY,
    leave_application_id VARCHAR(50) NOT NULL REFERENCES leave_applications(id) ON DELETE CASCADE,
    student_id VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    pass_code VARCHAR(50) NOT NULL UNIQUE,
    valid_from TIMESTAMP NOT NULL,
    valid_to TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'issued' CHECK (status IN ('issued', 'used', 'expired', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gate_movements (
    id VARCHAR(50) PRIMARY KEY,
    gate_pass_id VARCHAR(50) REFERENCES gate_passes(id) ON DELETE SET NULL,
    student_id VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    movement_type VARCHAR(10) NOT NULL CHECK (movement_type IN ('EXIT', 'ENTRY')),
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_by_user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    checkpoint VARCHAR(100) DEFAULT 'Main University Gate',
    notes TEXT
);

-- 8. COMPLAINTS & MAINTENANCE
CREATE TABLE IF NOT EXISTS complaints (
    id VARCHAR(50) PRIMARY KEY,
    complaint_number VARCHAR(50) NOT NULL UNIQUE,
    student_id VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    hostel_id VARCHAR(50) NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
    room_id VARCHAR(50) REFERENCES rooms(id) ON DELETE SET NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('water', 'electricity', 'room_maintenance', 'furniture', 'cleanliness', 'washroom', 'internet', 'food_quality', 'security', 'other')),
    description TEXT NOT NULL,
    image_urls TEXT DEFAULT '[]',
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN ('submitted', 'assigned', 'in_progress', 'resolved', 'closed')),
    assigned_to_user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    resolved_at TIMESTAMP,
    student_rating INT CHECK (student_rating BETWEEN 1 AND 5),
    student_feedback TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. MESS OPERATIONS: MENU, INVENTORY, WASTAGE
CREATE TABLE IF NOT EXISTS mess_menus (
    id VARCHAR(50) PRIMARY KEY,
    hostel_id VARCHAR(50) NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
    day_of_week VARCHAR(20) NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
    meal_session_id VARCHAR(50) NOT NULL REFERENCES meal_sessions(id) ON DELETE CASCADE,
    menu_items TEXT NOT NULL,
    is_special BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hostel_id, day_of_week, meal_session_id)
);

CREATE TABLE IF NOT EXISTS mess_inventory (
    id VARCHAR(50) PRIMARY KEY,
    hostel_id VARCHAR(50) NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
    item_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('grains', 'vegetables', 'dairy', 'spices', 'oils', 'gas_fuel', 'cleaning')),
    quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
    unit VARCHAR(20) NOT NULL,
    min_stock_threshold NUMERIC(10,2) DEFAULT 10,
    last_restocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mess_inventory_transactions (
    id VARCHAR(50) PRIMARY KEY,
    inventory_item_id VARCHAR(50) NOT NULL REFERENCES mess_inventory(id) ON DELETE CASCADE,
    transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('IN', 'OUT', 'WASTAGE')),
    quantity NUMERIC(10,2) NOT NULL,
    recorded_by_user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS food_wastage_logs (
    id VARCHAR(50) PRIMARY KEY,
    hostel_id VARCHAR(50) NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
    meal_session_id VARCHAR(50) NOT NULL REFERENCES meal_sessions(id) ON DELETE RESTRICT,
    service_date DATE NOT NULL,
    weight_kg NUMERIC(6,2) NOT NULL,
    recorded_by_user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. ACCOUNTS & FEES
CREATE TABLE IF NOT EXISTS fee_structures (
    id VARCHAR(50) PRIMARY KEY,
    academic_year_id VARCHAR(50) NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    hostel_id VARCHAR(50) NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
    fee_type VARCHAR(50) NOT NULL CHECK (fee_type IN ('hostel_rent', 'mess_advance', 'caution_deposit', 'maintenance')),
    amount NUMERIC(10,2) NOT NULL,
    due_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_fee_ledgers (
    id VARCHAR(50) PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    fee_structure_id VARCHAR(50) NOT NULL REFERENCES fee_structures(id) ON DELETE CASCADE,
    amount_due NUMERIC(10,2) NOT NULL,
    amount_paid NUMERIC(10,2) DEFAULT 0,
    balance NUMERIC(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('paid', 'partial', 'unpaid', 'exempted')),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, fee_structure_id)
);

CREATE TABLE IF NOT EXISTS fee_payments (
    id VARCHAR(50) PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    ledger_id VARCHAR(50) NOT NULL REFERENCES student_fee_ledgers(id) ON DELETE CASCADE,
    transaction_reference VARCHAR(100) NOT NULL UNIQUE,
    payment_mode VARCHAR(30) DEFAULT 'upi' CHECK (payment_mode IN ('online_gateway', 'bank_challan', 'upi', 'dd')),
    amount NUMERIC(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed')),
    receipt_number VARCHAR(100) NOT NULL UNIQUE,
    verified_by_user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. VISITOR MANAGEMENT
CREATE TABLE IF NOT EXISTS visitors (
    id VARCHAR(50) PRIMARY KEY,
    hostel_id VARCHAR(50) NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
    student_id VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    visitor_name VARCHAR(255) NOT NULL,
    visitor_phone VARCHAR(20) NOT NULL,
    relation_to_student VARCHAR(50) NOT NULL,
    purpose TEXT NOT NULL,
    id_proof_type VARCHAR(50) DEFAULT 'Aadhaar Card',
    id_proof_number VARCHAR(100),
    check_in_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    check_out_time TIMESTAMP,
    security_user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(20) DEFAULT 'checked_in' CHECK (status IN ('checked_in', 'checked_out'))
);

-- 12. ANNOUNCEMENTS & AUDIT LOGS
CREATE TABLE IF NOT EXISTS announcements (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    target_audience VARCHAR(20) DEFAULT 'ALL' CHECK (target_audience IN ('ALL', 'BOYS', 'GIRLS', 'HOSTEL', 'BLOCK')),
    hostel_id VARCHAR(50) REFERENCES hostels(id) ON DELETE CASCADE,
    block_id VARCHAR(50) REFERENCES blocks(id) ON DELETE CASCADE,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent', 'emergency')),
    published_by_user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    ip_address VARCHAR(50),
    user_agent TEXT,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES FOR MAXIMUM SCAN SPEED & LOOKUP PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_students_roll ON students(roll_number);
CREATE INDEX IF NOT EXISTS idx_students_reg ON students(reg_number);
CREATE INDEX IF NOT EXISTS idx_students_qr ON students(qr_credential_token);
CREATE INDEX IF NOT EXISTS idx_allocations_student ON student_allocations(student_id);
CREATE INDEX IF NOT EXISTS idx_allocations_room ON student_allocations(room_id);
CREATE INDEX IF NOT EXISTS idx_meal_tx_date_session ON meal_transactions(service_date, meal_session_id);
CREATE INDEX IF NOT EXISTS idx_meal_tx_student_date ON meal_transactions(student_id, service_date);
CREATE INDEX IF NOT EXISTS idx_scan_attempts_date ON scan_attempts(scanned_at);
CREATE INDEX IF NOT EXISTS idx_complaints_hostel ON complaints(hostel_id);
CREATE INDEX IF NOT EXISTS idx_leave_student ON leave_applications(student_id);
