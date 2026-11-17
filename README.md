# Adikavi Nannaya University (AKNU) — Hostel Management System
### Integrated Web Portal & Android Mobile Application

![AKNU Hostels Banner](https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&h=400&fit=crop)

A complete, production-ready, centralized Hostel Management System engineered for **Adikavi Nannaya University (AKNU)**. Manages both boys' and girls' hostels across campuses through a responsive web portal and Android mobile application connected to a centralized database.

---

## 🌟 Key Features & Highlights

### 1. ⚡ Critical Engine: Warden-Operated Meal Scanning
- **Warden-Operated Verification**: Staff scan students' personal QR credentials (avoiding wall QR vulnerabilities).
- **Cryptographic Student Tokens**: HMAC-SHA256 signed, salted, and tamper-resistant credentials that avoid leaking confidential phone numbers or personal data.
- **Atomic Duplicate Lock**: Database-level composite uniqueness constraint `UNIQUE (student_id, service_date, meal_session_id)` combined with transactional row-level checks prevents double meals from concurrent scans, rapid tapping, or multiple wardens.
- **Instant Audio-Visual Feedback**: High-throughput terminal with audible dings, clear green success cards, red duplicate warnings with prior scan timestamps, and automatic next-student reset.
- **Authorized Overrides & Corrections**: Warden manual search by roll number with mandatory justification, plus permanent reversal audit logging.

### 2. 👥 Complete Student Records & Bulk Excel/CSV Import
- Individual student profiles with department, course, room/bed assignment, and mess eligibility.
- Pre-formatted Excel template download (`docs/sample_students_import.xlsx`).
- Upload validation for duplicate roll/registration numbers with downloadable error reports.
- Printable photographic digital student ID cards with high-density QR codes.

### 3. 🏢 Multilevel Hostel & Room Hierarchy
- Hierarchy: University → Category (Boys/Girls) → Hostel Building → Block → Floor → Room → Bed Inventory.
- Manages *Godavari Bhavan (BH-1)*, *Krishna Bhavan (BH-2)*, *Saraswati Bhavan (GH-1)*, and *Gautami Bhavan (GH-2)*.
- Bed occupancy matrix (vacant, occupied, maintenance-blocked) and atomic room transfer logs.

### 4. 🛂 Leave, Digital Gate Passes & Security Checkpoints
- Student out-pass applications (Home, Medical, Academic, Emergency).
- Warden digital approval with instant `GP-XXXXXX` digital gate pass issuance.
- Campus security staff verification terminal with exit/entry movement logs.

### 5. 🛠 Maintenance Complaints & 5-Star Feedback
- Categorized ticketing (Plumbing, Electricity, Cleanliness, Food Quality, Internet).
- Status pipeline: `Submitted` → `Assigned` → `In Progress` → `Resolved` → `Closed`.
- Resident 5-star rating and satisfaction feedback upon completion.

### 6. 🍲 Mess Operations, Menus & Inventory
- Weekly timetable across 7 days for Breakfast, Lunch, Evening Snacks, and Dinner.
- Kitchen grocery stock tracking with automated low-stock warnings.
- Daily weighed food wastage register in kilograms.

### 7. 💳 Accounts, Fees & Official Receipts
- Hostel rent, mess advance, and caution deposit ledgers.
- Installment payments with automatic balance adjustment.
- Printable official university receipts.

### 8. 🛡 Multi-Role RBAC with 1-Click Evaluation Switcher
Supports all 10 university personas:
1. Super Administrator
2. University Management
3. Chief Warden
4. Hostel Warden
5. Mess Manager
6. Mess Staff
7. Security Staff
8. Accounts Staff
9. Maintenance Staff
10. Student Resident

---

## 🛠 Technology Stack

- **Backend**: Node.js, Express.js, TypeScript.
- **Database**: PostgreSQL (Production schema with constraints, indexes, triggers, and local WASM PGlite fallback).
- **Web Portal**: React 18, TypeScript, Vite, Tailwind CSS, Lucide icons, HTML5 QR Code.
- **Android App**: React Native, Expo, Expo Camera, React Native SVG.
- **Security**: JWT session tokens, bcrypt password hashing, HMAC-SHA256 QR signatures.

---

## 🚀 Quickstart & Local Execution

### 1. Start the Backend API (Port 5000)
```bash
cd backend
npm install
npm run dev
# The backend automatically initializes tables and seeds all 10 university demo personas!
# API Base: http://localhost:5000/api/v1
# Health: http://localhost:5000/health
```

### 2. Start the Web Portal (Port 5173)
```bash
cd frontend
npm install
npm run dev
# Portal URL: http://localhost:5173/
```

### 3. Run Automated Tests
```bash
cd backend
npm test
# Runs 12 integration tests verifying auth, QR signatures, duplicate locks, leaves, and complaints!
```

---

## 🔑 Demo Login Accounts

All test accounts use the password: `Aknu@2026!`

- **Super Administrator**: `admin@aknu.edu.in`
- **University Management**: `registrar@aknu.edu.in`
- **Chief Warden**: `chiefwarden@aknu.edu.in`
- **Hostel Warden (Boys)**: `warden.boys@aknu.edu.in`
- **Hostel Warden (Girls)**: `warden.girls@aknu.edu.in`
- **Mess Manager**: `messmanager@aknu.edu.in`
- **Mess Staff**: `messstaff1@aknu.edu.in`
- **Security Staff**: `security@aknu.edu.in`
- **Accounts Staff**: `accounts@aknu.edu.in`
- **Maintenance Staff**: `maintenance@aknu.edu.in`
- **Student Resident**: `student.rahul@aknu.edu.in`

*(Note: The web portal also features a "1-Click Role Logins" button bar on the login screen and navbar for instant testing of all 10 roles without manual typing!)*

---

## 📂 Project Directory Structure

```
Hostel-Management/
├── backend/                  # Node.js + Express + TypeScript API Server
│   ├── src/
│   │   ├── config/           # Database engine (PostgreSQL/PGlite), JWT configs
│   │   ├── controllers/      # 10 modular controllers
│   │   ├── middleware/       # RBAC guards, authentication, audit logger
│   │   ├── models/           # Database schemaInit & seeders
│   │   ├── routes/           # Versioned REST endpoints (/api/v1/*)
│   │   ├── utils/            # Cryptographic QR token generator & signer
│   │   └── server.ts         # Server entrypoint
│   └── tests/                # Automated integration test runner (12 tests)
│
├── frontend/                 # Web Portal (React + Vite + TypeScript + Tailwind CSS)
│   ├── src/
│   │   ├── components/       # Navbar, Sidebar, DigitalIdCardModal, RoleSwitcherModal
│   │   ├── context/          # AuthContext with 1-click role switcher presets
│   │   ├── pages/            # Dashboard, MealScanner, Students, Hostels, Leave, Complaints, etc.
│   │   └── App.tsx
│
├── mobile/                   # Android Mobile Application (React Native / Expo)
│   ├── src/
│   │   └── config/           # Mobile API connector (Android emulator & device)
│   ├── App.tsx               # Mobile app with Student ID, Warden Scanner, Security Gate
│   └── app.json              # Android package: in.edu.aknu.hostels, camera permissions
│
├── database/
│   └── schema.sql            # Full PostgreSQL DDL schema with relational constraints & indexes
│
└── docs/                     # Deliverables documentation
    ├── api_documentation.md  # Detailed REST API reference
    ├── vps_deployment_guide.md# Linux VPS, Nginx, PM2, and Let's Encrypt SSL guide
    ├── android_build_guide.md# EAS Build and Gradle APK compilation guide
    ├── backup_and_recovery.md# Automated pg_dump cron and restoration procedures
    ├── admin_and_warden_guide.md # Step-by-step user operation instructions
    └── sample_students_import.xlsx # Ready-to-use sample spreadsheet for bulk import
```
