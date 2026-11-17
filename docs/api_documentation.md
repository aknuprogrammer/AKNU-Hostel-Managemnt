# AKNU Hostel Management System — REST API Documentation (v1)

## Base URL
- Local Development: `http://localhost:5000/api/v1`
- Production: `https://hostels.aknu.edu.in/api/v1`

---

## Authentication & Authorization
All secured endpoints require the `Authorization` HTTP header with a Bearer token:
```http
Authorization: Bearer <jwt_token>
```

### Active Portal Roles (With System Login Access):
- `super_admin`: Full system configuration, hostel oversight, and audit access
- `chief_warden`: Oversees all university hostels, warden assignments, policies
- `hostel_warden`: Manages assigned hostel allocations, meal scans, leaves, visitors
- `mess_manager`: Manages dining menus, inventory, wastage logs, counter oversight
- `student`: Self-service portal (personal cryptographic QR ID, leaves, complaints)

### Record-Only Personnel Roles (Maintained for University Records Only — No Login Access):
- `univ_mgmt`: University Management / Registrar records
- `mess_staff`: Dining counter attendants and kitchen staff directory
- `security_staff`: Gate security personnel on duty
- `accounts_staff`: Bursar / Accounts desk personnel records
- `maint_staff`: Electricians, plumbers, and maintenance personnel directory

---

## 1. Authentication Endpoints

### `POST /auth/login`
Authenticates a user and returns a signed session token.
- **Request Body:**
  ```json
  {
    "email": "warden.boys@aknu.edu.in",
    "password": "Aknu@2026!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOi...",
    "user": {
      "id": "usr-warden-bh",
      "email": "warden.boys@aknu.edu.in",
      "fullName": "Dr. P. Satyanarayana",
      "role": "hostel_warden",
      "roleDisplay": "Hostel Warden",
      "assignedHostels": [{ "id": "hostel-bh1", "name": "Godavari Bhavan" }]
    }
  }
  ```

### `GET /auth/me`
Retrieves current profile and permissions for the authenticated token.

---

## 2. Warden-Operated Meal Scanning (Critical Engine)

### `GET /meal-scans/active-session`
Returns active meal session computed based on local university time and grace periods.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "activeSession": {
        "id": "ms-lunch",
        "name": "Afternoon Lunch",
        "code": "lunch",
        "start_time": "12:30",
        "end_time": "14:30",
        "grace_minutes": 15,
        "remainingMinutes": 75
      }
    }
  }
  ```

### `POST /meal-scans/scan`
Atomically verifies a student's personal QR credential.
- **Request Body:**
  ```json
  {
    "qrToken": "aknu_v1.eyJzdHVkZW50SWQiOiJzdHUtcmFodWwi...signature",
    "mealSessionId": "ms-lunch",
    "hostelId": "hostel-bh1",
    "checkpointName": "Counter 1"
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "resultStatus": "SUCCESS",
    "title": "Meal Verified & Recorded",
    "transaction": {
      "id": "5a8bc26c-4144-4d6a-8a68-c9f40eb65e6c",
      "scannedAt": "2026-10-12T12:35:00.000Z",
      "sessionName": "Afternoon Lunch"
    },
    "student": {
      "id": "stu-rahul",
      "fullName": "Rahul Varma",
      "rollNumber": "22CSE042",
      "hostelName": "Godavari Bhavan (Boys' Hostel 1)",
      "roomNumber": "101"
    }
  }
  ```
- **Duplicate Response (409 Conflict):**
  ```json
  {
    "success": false,
    "resultStatus": "DUPLICATE",
    "title": "Duplicate Meal Scan Detected",
    "message": "This student has already availed Afternoon Lunch today at 12:35:00 pm. Multiple meals in a single session are prohibited."
  }
  ```
- **Tampered QR Response (400 Bad Request):**
  ```json
  {
    "success": false,
    "resultStatus": "INVALID_CREDENTIAL",
    "title": "Invalid QR Credential",
    "message": "The scanned QR code is malformed, expired, or has an invalid university signature."
  }
  ```

### `POST /meal-scans/manual-override`
Authorized warden manual meal recording by roll number with mandatory justification.
- **Request Body:**
  ```json
  {
    "rollNumber": "22CSE042",
    "mealSessionId": "ms-lunch",
    "hostelId": "hostel-bh1",
    "overrideReason": "Student phone battery drained; physically verified with university badge"
  }
  ```

### `POST /meal-scans/correct-transaction`
Reverses a mistakenly scanned meal transaction with permanent audit trail.
- **Request Body:**
  ```json
  {
    "transactionId": "5a8bc26c-...",
    "newStatus": "REVERSED",
    "reason": "Scanner barcode misalignment"
  }
  ```

---

## 3. Student Management & Bulk Import

### `GET /students`
Query parameters: `search`, `hostelId`, `departmentId`, `status`, `page`, `limit`.

### `POST /students`
Registers a new student, generates unique student ID, salt, and signs cryptographic QR token.

### `POST /students/:id/regenerate-qr`
Revokes prior QR tokens by cycling `qr_salt` and creates a fresh signed token.

### `POST /students/bulk-import`
Accepts `multipart/form-data` with `file` (.xlsx or .csv). Validates duplicates and produces summary with failed rows report.

---

## 4. Hostel & Room Management

### `GET /hostels`
Returns hostels with total rooms, capacity, and current occupied beds.

### `GET /hostels/rooms/beds`
Returns room and bed inventory with resident allocations.

### `POST /hostels/transfers`
Executes room transfer or hostel transfer, closes old allocation, and logs history.

---

## 5. Leave & Gate Passes

### `POST /leave/apply`
Student submits out-pass application.

### `PATCH /leave/:id/status`
Warden approves or rejects application. Approval automatically generates digital gate pass.

### `GET /leave/gate-pass/:passCode`
Security staff validates student gate pass by pass code.

### `POST /leave/gate-movements`
Records `EXIT` or `ENTRY` movement at university checkpoint.

---

## 6. Complaints & Maintenance

### `POST /complaints`
Student lodges maintenance ticket.

### `PATCH /complaints/:id/status`
Maintenance updates status (`assigned` -> `in_progress` -> `resolved` -> `closed`).

### `POST /complaints/:id/rate`
Student rates resolution with 1 to 5 stars.

---

## 7. Mess Menus & Inventory

### `GET /mess/menu?hostelId=hostel-bh1&dayOfWeek=Monday`
Returns day's meal timetable.

### `GET /mess/inventory?hostelId=hostel-bh1`
Returns grocery stock with `is_low_stock` indicators.

### `POST /mess/inventory/transactions`
Records `IN` or `OUT` stock movements.

### `POST /mess/wastage`
Logs daily weighed food wastage in kilograms.

---

## 8. Accounts & Financials

### `GET /finance/ledgers`
Returns student fee ledgers.

### `POST /finance/payments`
Records student installment and generates official numbered receipt.

---

## 9. Security Visitors

### `POST /visitors/register`
Checks in visitor with name, phone, relation, and photo ID reference.

### `PATCH /visitors/:id/checkout`
Records visitor exit timestamp.
