# AKNU Hostel Management System — Administrator & Warden Operations Guide

## 1. Quick Credentials Reference

All seeded test accounts use the password: `Aknu@2026!`

| Role Persona | Email Address | Primary Duties |
|---|---|---|
| **Super Administrator** | `admin@aknu.edu.in` | Global configuration, bulk imports, audit logs |
| **University Management** | `registrar@aknu.edu.in` | Consolidated campus metrics & occupancy reports |
| **Chief Warden** | `chiefwarden@aknu.edu.in` | Multi-hostel supervision & leave escalations |
| **Hostel Warden (Boys)** | `warden.boys@aknu.edu.in` | Godavari Bhavan (BH-1) meal scans & room allocations |
| **Hostel Warden (Girls)** | `warden.girls@aknu.edu.in` | Saraswati Bhavan (GH-1) meal scans & room allocations |
| **Mess Manager** | `messmanager@aknu.edu.in` | Weekly timetables, grocery inventory, wastage logs |
| **Mess Staff** | `messstaff1@aknu.edu.in` | High-volume counter QR meal scanning |
| **Security Staff** | `security@aknu.edu.in` | Main gate pass validation & visitor logbook |
| **Accounts Staff** | `accounts@aknu.edu.in` | Fee ledgers, payment collection, receipts |
| **Maintenance Staff** | `maintenance@aknu.edu.in` | Electric, plumbing, and carpentry work orders |
| **Student Resident** | `student.rahul@aknu.edu.in` | Digital QR ID, out-passes, complaint lodging |

---

## 2. Administrator Workflows

### A. Bulk Student Roster Import
1. Navigate to **Student Records** in the sidebar.
2. Click **Bulk Excel / CSV Import**.
3. Download the pre-formatted `sample_students_import.xlsx` template if needed.
4. Drag and drop the Excel file.
5. The system automatically:
   - Validates mandatory fields.
   - Prevents duplicate roll numbers or emails.
   - Signs unique cryptographic HMAC-SHA256 tokens.
   - Provides an instant summary with a downloadable failed-rows report for any rejected entries.

### B. Bed Allocation & Room Transfers
1. Navigate to **Hostels & Rooms**.
2. Select the hostel building (e.g., *Godavari Bhavan BH-1*).
3. The visual bed matrix displays green (vacant) and blue (occupied) beds.
4. Click **Room / Hostel Transfer** to reallocate a student with a mandatory audit reason. The prior bed is cleared automatically.

---

## 3. Warden Meal Scanning Terminal Operations

### A. High-Throughput Queue Service
1. Authenticate and select **Meal QR Scanner**.
2. Select your active hostel (e.g., *Godavari Bhavan BH-1*) and counter.
3. The terminal automatically detects the current meal session (*Breakfast, Lunch, Snacks, Dinner*) and calculates remaining service time.
4. Click **Start Camera Scanner** on Android or webcam.
5. Point the student's personal digital QR code at the camera.
6. **Instant Feedback**:
   - **Green Ding (200 OK)**: Meal successfully verified and recorded atomically. Counter increments.
   - **Red Warning Buzz (409 Conflict)**: Duplicate scan detected! The banner shows the exact timestamp of the student's prior meal today.
   - **Amber Alert**: Outside meal session hours or student mess eligibility suspended.
7. The scanner resets automatically within 6 seconds (or immediately on touch) for the next student.

### B. Exception Handling & Manual Override
If a student's phone battery is depleted or the camera lens is smudged:
1. Click **Manual Override**.
2. Enter the student's university roll number (e.g. `22CSE042`).
3. Enter the required override justification (e.g. *"Phone battery depleted, verified physical student ID card"*).
4. Click **Confirm & Record**. The meal transaction is recorded under the warden's name in the permanent audit trail.

### C. Mistake Correction & Reversal
If a barcode was scanned accidentally:
1. In the **Recent Mess Scan Log** list, click **Correct**.
2. Enter the reversal justification reason.
3. The transaction is marked as `REVERSED` without deleting historical audit integrity.

---

## 4. Student Resident Operations

1. Sign in with student email (`student.rahul@aknu.edu.in`).
2. Click **Show My QR Digital ID** on the navigation bar.
3. Display the official credential at the mess counter to receive meals.
4. Navigate to **Leave & Gate Pass** to apply for home visits.
5. Once approved by the warden, the digital pass code is generated for verification at the campus security gate.
