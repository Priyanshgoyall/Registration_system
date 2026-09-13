# Student Registration & Certificate Management System - Technical Summary

`PROJECT_SUMMARY.md` serves as the authoritative, empirical technical reference for the current codebase architecture, state management, backend services, schema relationships, storage rules, security models, and end-to-end data flows.

---

## 1. Project Overview

* **What the Software Does**: An end-to-end admission counter, student kiosk, event management, and certificate issuance platform. It handles student registration via interactive voice input and live camera capture, generates instant student ID cards, tracks session attendance, allows admins/coordinators to manage academic programs, bulk-generates digital certificates with custom image templates and dynamic text overlays, and enables public QR verification.
* **Main Purpose**: Streamline event and admission kiosk registrations using hands-free Indian-English voice recognition, automate ID card PDF generation, manage sessions and student attendance, and issue verifiable digital certificates with anti-tamper QR codes.
* **Who Uses It**:
  * **Students**: Self-fill or speak details at counter kiosks and view/download registration ID cards.
  * **Coordinators**: Desk operators authenticated to run admission counters, verify student sessions, and log counter activity.
  * **Admins**: System administrators managing sessions, student databases, registrations, daily attendance, coordinator accounts, bulk CSV exports, and certificate templates/issuance.
  * **Public Verifiers**: Third parties scanning certificate QR codes or visiting the public `/verify` page to check authenticity.
* **Main Technologies**: React 19, Vite 8, Supabase (PostgreSQL, Auth, Storage, RLS), Web Speech API (`SpeechRecognition`), TailwindCSS, jsPDF, html2canvas, and lucide-react.

---

## 2. Technology Stack

* **Frontend**: React `^19.2.8`, Vite `^8.3.0`, React Router DOM `^7.18.3`.
* **UI / Styling**: Vanilla CSS design system (`index.css`), TailwindCSS `^3.4.19`, Lucide React icons `^1.45.0`, React Hot Toast `^2.6.0`.
* **Backend**: Serverless architecture powered directly by Supabase BaaS (PostgreSQL database, Row Level Security, Storage, Auth).
* **Database**: Supabase PostgreSQL 15+ with UUID extension (`uuid-ossp`), triggers, indexes, and RLS policies.
* **Authentication**: Supabase Auth (Email + Password). Supports primary persistent admin sessions and isolated, non-persisted tab-scoped coordinator desk sessions (`sessionStorage`).
* **Storage**: Supabase Storage (`student-photos` bucket, `certificates` bucket).
* **Speech-to-Text**: Native Browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) configured for Indian English (`en-IN`).
* **Certificate / PDF Generation**: `jspdf` `^4.2.1` (vector PDF rendering), `html2canvas` `^1.4.1` (ID card canvas rasterization).
* **QR Verification**: `qrcode` `^1.5.4` generating inline base64 Data URLs embedded into PDFs and verification routes.
* **Camera Capture**: `react-webcam` `^7.2.0`.
* **Linting & Tooling**: `oxlint` `^1.81.0`, PostCSS, Autoprefixer.

---

## 3. Project Structure

```text
Student-Registration-System/
 ├── index.html                           # Main HTML document entry point
 ├── package.json                         # Project dependencies, scripts, and build metadata
 ├── vite.config.js                       # Vite builder configuration
 ├── tailwind.config.js                   # TailwindCSS theme tokens & design system rules
 ├── postcss.config.js                    # PostCSS plugin configurations
 ├── .env                                 # Local environment configuration variables
 ├── .env.example                         # Example environment template
 ├── supabase/
 │    └── schema.sql                      # Complete SQL DDL, RLS policies, buckets, & triggers
 └── src/
      ├── main.jsx                        # React root launcher rendering App
      ├── App.jsx                         # Top-level Router configuration & layout routing
      ├── index.css                       # Global design system, glassmorphism, & base styles
      ├── components/
      │    ├── AdminLayout.jsx            # Admin panel sidebar, top navbar, & layout wrapper
      │    ├── Modal.jsx                  # Reusable accessible modal dialog overlay
      │    ├── ProtectedRoute.jsx         # Route guard enforcing active admin/coordinator auth
      │    ├── RegistrationCard.jsx       # Print-ready student ID card UI component
      │    └── Spinner.jsx                # Loading indicator spinner
      ├── hooks/
      │    └── useAuth.js                 # Custom React hook for Supabase auth state & profile roles
      ├── lib/
      │    └── supabase.js                # Singleton Supabase JS client instance initialization
      ├── utils/
      │    ├── exportCSV.js               # Helper utility for formatted CSV data exports
      │    ├── generateCertificatePDF.js  # jsPDF generator for dynamic vector certificates
      │    ├── generateId.js              # Cryptographic generator for registration & cert IDs
      │    ├── generatePDF.js             # html2canvas + jsPDF converter for student ID cards
      │    ├── generateQR.js              # Base64 QR code canvas generator helper
      │    └── speechNormalize.js         # Speech-to-text normalizers for names, email, phone, city
      └── pages/
           ├── KioskPage.jsx              # Kiosk wizard, desk login, photo capture, voice step
           ├── LoginPage.jsx              # Admin authentication login portal page
           ├── SuccessPage.jsx            # Registration success summary & ID card download page
           ├── VerifyPage.jsx             # Public certificate & ID verification portal page
           └── admin/
                ├── Attendance.jsx        # Daily attendance tracking & status logging page
                ├── Certificates.jsx      # Certificate template upload, bulk issuance, revocation
                ├── Coordinators.jsx      # Coordinator account creation & permissions manager
                ├── Dashboard.jsx         # System analytics, session metrics, & registration charts
                ├── Registrations.jsx     # Registration management, filter, search, & status updates
                ├── Sessions.jsx          # Academic program session CRUD and status management
                └── Students.jsx         # Centralized student master directory & search page
```

---

## 4. Frontend Architecture

### Main Pages & Routes
* `/`: `KioskPage.jsx` — Multi-step student registration wizard, coordinator counter login, photo capture, and hands-free voice field entry.
* `/success/:registrationId`: `SuccessPage.jsx` — Confirmation page displaying student ID card, registration details, and PDF download button.
* `/verify`: `VerifyPage.jsx` — Public verification portal supporting instant certificate & registration validation via URL query parameters (`?cert=CERT-xxx`) or manual search.
* `/admin/login`: `LoginPage.jsx` — Administrator portal authentication page.
* `/admin/*`: Protected admin layout wrapping:
  * `/admin`: `Dashboard.jsx` (metrics & analytics).
  * `/admin/sessions`: `Sessions.jsx` (session management).
  * `/admin/students`: `Students.jsx` (master directory).
  * `/admin/registrations`: `Registrations.jsx` (registration records & CSV export).
  * `/admin/attendance`: `Attendance.jsx` (session attendance logger).
  * `/admin/certificates`: `Certificates.jsx` (certificate issuance, template overlays, revocation).
  * `/admin/coordinators`: `Coordinators.jsx` (coordinator user management).

### Portal & Interface Division
* **Student Portal**: Step-by-step registration flow (Session selection → Photo capture → Voice/Manual details → Review/Confirm → ID card display).
* **Coordinator Interface**: Unlocks counter operations on `/` using desk login. Supports viewing session registrations without admin backend access.
* **Admin Panel**: Full system control with sidebar navigation (`AdminLayout.jsx`), route guards (`ProtectedRoute.jsx`), statistics metrics, table operations, CSV exporting, and certificate management.

### Key Interactive Flows
* **State Management**: Local state using React `useState`, `useRef`, and `useCallback`, combined with custom `useAuth` hook for global auth state and Supabase real-time updates.
* **Forms & Auto-Scroll**: Step 2 of `KioskPage.jsx` maps field refs (`fieldRefs`). Switching active fields (via voice progression or focus) triggers smooth container auto-scrolling (`el.scrollIntoView({ behavior: 'smooth', block: 'center' })`).
* **Camera / Photo Flow**: `react-webcam` captures JPEG screenshots converted to Blob binary objects and uploaded to Supabase Storage `student-photos`.
* **Voice / Speech Flow**: `listenForField(index)` initializes Web Speech API `SpeechRecognition` in `en-IN` locale. Speech input is accumulated and passed to `normalizeForField()`.
* **Speech Parsing**: `speechNormalize.js` handles prefix stripping, title removal (e.g., "Mr." / "Mrs."), email symbol conversion (`"at the rate"` → `@`, `"dot"` → `.`), digit extraction for phone numbers, and title-case formatting.
* **Confirmation & Edit Flow**: Step 3 allows inline editing of parsed details before final Supabase transaction commit.
* **ID Card Generation**: `RegistrationCard.jsx` renders card layout; `generatePDF.js` converts DOM nodes to canvas via `html2canvas` and exports A6/custom PDFs using `jspdf`.

---

## 5. Backend Architecture

The application communicates directly with **Supabase BaaS** via `@supabase/supabase-js` without an intermediate custom Express/Node server.

```text
React Frontend (Vite)
       │
       ▼ `@supabase/supabase-js` Client Singleton (lib/supabase.js)
 ┌─────┴───────────────────────────────────────────────────────┐
 │                     Supabase BaaS                           │
 │  ┌─────────────────┬────────────────────┬────────────────┐  │
 │  │ Auth Service    │ PostgreSQL DB      │ Storage API    │  │
 │  │ (JWT Tokens)    │ (RLS & Triggers)   │ (Buckets)      │  │
 │  └─────────────────┴────────────────────┴────────────────┘  │
 └─────────────────────────────────────────────────────────────┘
```

* **Client Configuration**: Initialized in `src/lib/supabase.js` using `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY`.
* **Authentication API**:
  * Persistent Admin Login: `supabase.auth.signInWithPassword()`.
  * Isolated Coordinator Desk Login: Non-persisting client instance created via `createClient(url, key, { auth: { persistSession: false } })` to authenticate counter operators without disturbing active admin tokens in `localStorage`.
* **Database Queries**: Declarative Supabase queries with join syntax (`select('*, students(*), sessions(*)')`), table filtering, order by, and single/maybeSingle execution.
* **Storage Operations**: `supabase.storage.from('bucket').upload()` and `.getPublicUrl()`.
* **Security & RLS**: All tables have Row Level Security enabled. Policies dictate read/write permissions for `anon` (kiosk/verification) vs `authenticated` (admin/coordinator) roles.

---

## 6. Database Architecture

The PostgreSQL schema uses 6 core tables with relational integrity and automated triggers:

```text
students (id)
   │
   ├──────► registrations (id, student_id, session_id) ◄────── sessions (id)
   │               │
   │               ├──────► attendance (id, registration_id)
   │               │
   │               └──────► certificates (id, registration_id)
   │
auth.users (id)
   │
   └──────► user_profiles (id)
```

### Table Details

#### 1. `public.students`
* **Purpose**: Master directory storing unique student identity attributes.
* **Columns**: `id` (UUID, PK), `name` (TEXT), `email` (TEXT), `phone` (TEXT), `school_name` (TEXT), `city` (TEXT), `photo_url` (TEXT), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
* **Primary Key**: `id`
* **Foreign Keys**: None
* **Indexes**: `idx_students_phone` on `phone`, `idx_students_name` on `name`.
* **Triggers**: `students_updated_at` (executes `handle_updated_at()` before UPDATE).

#### 2. `public.sessions`
* **Purpose**: Academic program sessions and event tracking.
* **Columns**: `id` (UUID, PK), `name` (TEXT), `description` (TEXT), `start_date` (DATE), `end_date` (DATE), `status` (TEXT: `'upcoming'`, `'active'`, `'completed'`, `'cancelled'`), `created_at` (TIMESTAMPTZ).
* **Primary Key**: `id`
* **Foreign Keys**: None
* **Constraints**: Status check constraint. Auto-expires at 00:00 AM after `end_date`.

#### 3. `public.registrations`
* **Purpose**: Link table connecting students to program sessions.
* **Columns**: `id` (UUID, PK), `student_id` (UUID, FK), `session_id` (UUID, FK), `class` (TEXT), `email` (TEXT), `city` (TEXT), `registration_id` (TEXT, UNIQUE), `registration_status` (TEXT: `'pending'`, `'confirmed'`, `'cancelled'`), `registered_at` (TIMESTAMPTZ).
* **Primary Key**: `id`
* **Foreign Keys**: `student_id` REFERENCES `students(id)` ON DELETE CASCADE, `session_id` REFERENCES `sessions(id)` ON DELETE CASCADE.
* **Constraints**: `UNIQUE(student_id, session_id)` (prevents duplicate session registration), `registration_id` UNIQUE.
* **Indexes**: `idx_registrations_student_id`, `idx_registrations_session_id`.

#### 4. `public.attendance`
* **Purpose**: Daily attendance status logs for registered students.
* **Columns**: `id` (UUID, PK), `registration_id` (UUID, FK), `attendance_date` (DATE), `status` (TEXT: `'present'`, `'absent'`, `'late'`).
* **Primary Key**: `id`
* **Foreign Keys**: `registration_id` REFERENCES `registrations(id)` ON DELETE CASCADE.
* **Constraints**: `UNIQUE(registration_id, attendance_date)`.
* **Indexes**: `idx_attendance_registration_id`.

#### 5. `public.certificates`
* **Purpose**: Issued digital certificates and verification status.
* **Columns**: `id` (UUID, PK), `registration_id` (UUID, FK), `certificate_id` (TEXT, UNIQUE), `certificate_url` (TEXT), `issued_at` (TIMESTAMPTZ), `verification_status` (TEXT: `'valid'`, `'revoked'`).
* **Primary Key**: `id`
* **Foreign Keys**: `registration_id` REFERENCES `registrations(id)` ON DELETE CASCADE.
* **Constraints**: `UNIQUE(registration_id)`, `certificate_id` UNIQUE.
* **Indexes**: `idx_certificates_registration_id`, `idx_certificates_certificate_id`.

#### 6. `public.user_profiles`
* **Purpose**: Extended role metadata for auth users (admin & coordinators).
* **Columns**: `id` (UUID, PK, FK), `email` (TEXT), `full_name` (TEXT), `role` (TEXT: `'admin'`, `'coordinator'`), `is_active` (BOOLEAN), `created_at` (TIMESTAMPTZ).
* **Primary Key**: `id`
* **Foreign Keys**: `id` REFERENCES `auth.users(id)` ON DELETE CASCADE.

---

## 7. Storage

* **Supabase Storage Buckets**:
  1. `student-photos` (Public: `true`): Stores student avatar captures (`.jpg`).
  2. `certificates` (Public: `true`): Stores generated certificate PDF files (`.pdf`).
* **Photo Upload Flow**:
  1. Kiosk captures webcam screenshot as Data URL.
  2. Converted to binary Blob via `fetch(dataUrl).blob()`.
  3. Uploaded to `student-photos/${Date.now()}_${rand}.jpg`.
  4. Public URL retrieved via `getPublicUrl()` and stored in `students.photo_url`.
* **Certificate Storage Flow**:
  1. `generateCertificatePDF()` renders landscape A4 vector PDF blob.
  2. Uploaded to `certificates/${certificate_id}.pdf`.
  3. Public URL stored in `certificates.certificate_url`.
* **Storage Security Policies**:
  * `student-photos`: `anon` can insert (kiosk capture); `anon` and `authenticated` can select; `authenticated` can update/delete.
  * `certificates`: `authenticated` can insert/update/delete; `anon` and `authenticated` can select for public verification.

---

## 8. Authentication & Roles

### Roles & Permissions Matrix

| Feature / Resource | Anonymous (`anon`) | Coordinator (`user_profiles`) | Main Admin (`admin`) |
| :--- | :---: | :---: | :---: |
| Kiosk Registration (`/`) | ✅ Register & Capture | ✅ Register & Counter Desk | ✅ Access |
| Check Registrations Modal | ❌ No | ✅ View Session Count & List | ✅ Access |
| Verify Certificate (`/verify`) | ✅ Read Only | ✅ Access | ✅ Access |
| Admin Dashboard (`/admin`) | ❌ Blocked | ⚠️ View Only (if active) | ✅ Full Access |
| Manage Sessions (`/admin/sessions`) | ❌ Blocked | ❌ Blocked | ✅ Create / Edit / Delete |
| Manage Coordinators (`/admin/coordinators`)| ❌ Blocked | ❌ Blocked | ✅ Create / Disable |
| Manage Certificates (`/admin/certificates`) | ❌ Blocked | ⚠️ Read / Issue (if granted) | ✅ Generate / Revoke |
| Daily Attendance (`/admin/attendance`) | ❌ Blocked | ✅ Mark & Log | ✅ Full Access |

### RLS Policies Highlights
* **Students & Registrations**: `anon_insert` allowed for counter registrations; `anon_select` allowed for success page display.
* **User Profiles**: Strict policy where desk logins check `email` against `user_profiles` to verify approval and ensure `is_active === true`.
* **Desk Session Isolation**: Coordinator logins use tab-scoped `sessionStorage` (`coord_desk_session`) with non-persisted Supabase auth clients, ensuring desk logout never terminates the main Admin session in `localStorage`.

---

## 9. Student Registration Flow

```text
Student / Coordinator at Kiosk
       │
       ▼
 [Step 0: Select Active Session] ── (Filters non-expired active sessions)
       │
       ▼
 [Step 1: Webcam Photo Capture]  ── (Optional live snapshot → Blob)
       │
       ▼
 [Step 2: Voice / Manual Details] ── (Sequence: Name → Email → Phone → School → City)
       │                                 │
       │                                 ├─► Web Speech API (en-IN)
       │                                 ├─► speechNormalize parsing & validation
       │                                 └─► Smooth auto-scroll active field into view
       ▼
 [Step 3: Review & Inline Edit]  ── (Verification of parsed form inputs)
       │
       ▼
 [Database Commit Transaction]   ── (Inserts student & registration records)
       │
       ▼
 [Step 4: Success & ID Card]     ── (Generates Registration ID & PDF Download)
```

---

## 10. Speech/Parsing System

* **Engine**: Native Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) initialized with `lang = 'en-IN'`, `interimResults = true`, and `continuous = true`.
* **Field Sequencing**: Iterates automatically through `VOICE_FIELDS`: Full Name → Gmail/Email → Phone Number → School Name → City.
* **Parsing Utilities (`speechNormalize.js`)**:
  * `normalizeName`: Strips phrase prefixes (`"my name is"`, `"i am"`) and honorific titles (`"Mr."`, `"Mrs."`, `"Ms."`, `"Dr."`, `"Prof."`), returning clean title-cased names.
  * `normalizeEmail`: Converts spoken phrases (`"at the rate"` → `@`, `"dot"` → `.`), converts spoken digit words (`"one two three"` → `"123"`), and strictly enforces complete `username@domain.ext` format (without auto-appending default domains).
  * `normalizePhone`: Converts spoken digit words, strips non-numeric characters (`\D`), and strictly requires a valid 10-digit numeric sequence (returning empty string if invalid).
  * `normalizeSchool` & `normalizeCity`: Strip location/school phrase prefixes and title-case the result.
* **Error & Retry Handling**: If voice input fails validation (e.g., missing 10 digits or incomplete email domain), an error toast is displayed, the field remains highlighted, and the microphone stays available for instant re-speech or manual typing.

---

## 11. Admin Flow

```text
Admin Login (/admin/login)
    │
    ├─► Dashboard (/admin)           ── Metrics cards, session selector, & registration breakdown
    ├─► Sessions (/admin/sessions)    ── Program CRUD, start/end dates, & status toggle
    ├─► Students (/admin/students)    ── Master student table, details view, & search
    ├─► Registrations (/admin/registrations) ── Filterable records, status management, CSV export
    ├─► Attendance (/admin/attendance)── Date/Session selector, student toggle (Present/Absent)
    ├─► Coordinators (/admin/coordinators) ── Create coordinator logins, manage active status
    └─► Certificates (/admin/certificates) ── Upload custom templates, bulk generation, PDF download, revocation
```

* **CSV Export**: `exportCSV.js` compiles filtered student/registration lists with UTF-8 BOM encoding for Excel compatibility.

---

## 12. Certificate System

* **Template Support**: Supports custom PNG/JPG background image uploads (`fileToDataUrl`) or defaults to a built-in dark slate & gold vector template.
* **Dynamic Overlay Fields**: Overlay engine positions student name, school/city/email meta line, session name, issue date, and unique `certificate_id`.
* **QR Code Generation**: `generateQR.js` builds base64 QR Data URLs encoding the verification URL: `https://<domain>/verify?cert=<CERT_ID>`.
* **PDF Engine**: `generateCertificatePDF.js` uses `jspdf` to generate landscape A4 vector PDFs (297mm × 210mm) containing crisp vector text, gold borders, and embedded QR codes.
* **Bulk Issuance**: `Certificates.jsx` provides multi-select checkboxes, session filtering, and progress tracking to batch-generate and upload PDFs to Supabase Storage.
* **Verification Route (`/verify`)**: `VerifyPage.jsx` fetches `certificates` joined with `registrations`, `students`, and `sessions`. Displays valid certificates with green badges or flags revoked certificates with warning banners.

---

## 13. Data Flow

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Student Kiosk / Portal                          │
│     (Photo Capture + Speech-to-Text + Form Entry + ID Card PDF)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          React Application                             │
│       (Routing, State Management, Custom Hooks, PDF Generators)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ `@supabase/supabase-js`
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           Supabase Platform                            │
│  ┌───────────────────────┬─────────────────────┬────────────────────┐  │
│  │ PostgreSQL Database   │ Storage Buckets     │ Auth Engine        │  │
│  │  - students           │  - student-photos   │  - Admin Auth      │  │
│  │  - sessions           │  - certificates     │  - Desk Auth       │  │
│  │  - registrations      │                     │  - user_profiles   │  │
│  │  - attendance         │                     │                    │  │
│  │  - certificates       │                     │                    │  │
│  └───────────────────────┴─────────────────────┴────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
          ┌─────────────────────────┴─────────────────────────┐
          ▼                                                   ▼
┌───────────────────────────────────┐               ┌───────────────────┐
│           Admin Panel             │               │ Public Verify UI  │
│ (Sessions, Students, CSV Exports, │               │ (/verify?cert=X)  │
│ Attendance, Bulk Certificates)    │               │  (QR Validation)  │
└───────────────────────────────────┘               └───────────────────┘
```

---

## 14. Important Configuration

### Required Environment Variables (`.env`)
```bash
# Supabase Project Connection Credentials
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
```

* **Location**: `.env` in project root directory (template provided in `.env.example`).
* **Vite Exposure**: Variables prefixed with `VITE_` are exposed to the client bundle via `import.meta.env`.

---

## 15. Current Status

### Fully Working Major Features
* ✅ Multi-step Student Registration Kiosk with live camera snapshot and speech-to-text.
* ✅ Indian-English voice normalizer for clean Name, Email, Phone, School, and City parsing.
* ✅ Automated student ID card rendering and PDF download.
* ✅ Isolated Coordinator Desk Login with non-persisted auth & session storage protection.
* ✅ Auto-scrolling active form field transitions during kiosk registration.
* ✅ Program Session management with automatic 00:00 AM end-date expiration filtering.
* ✅ Student Master Directory and Registration management with CSV data exports.
* ✅ Session Attendance tracking and daily logger.
* ✅ Certificate issuance engine with custom image template overlay support and bulk PDF rendering.
* ✅ Public Certificate & ID Card Verification Portal with anti-tamper QR codes.

### Important Dependencies
* Browser Web Speech API (`webkitSpeechRecognition`) — requires Chrome, Edge, or speech-compatible browser with microphone permissions.
* Supabase BaaS — active project instance with `schema.sql` applied.

### Known Limitations
* Mobile browsers without `webkitSpeechRecognition` support will default to manual text entry.

---
*Summary generated for technical reference and future development context.*
