# nano.HR — Web Admin Dashboard

HRIS (Human Resource Information System) berbasis web untuk PT Nano Indonesia Sakti. Dibangun dengan React + TypeScript + Vite, menggunakan Supabase sebagai backend dan database.

---

## Tech Stack

| Layer        | Technology                                    |
| ------------ | --------------------------------------------- |
| Frontend     | React 19, TypeScript, Vite                    |
| Styling      | Tailwind CSS v3, custom CSS components        |
| Routing      | React Router DOM v7                           |
| Backend / DB | Supabase (PostgreSQL + Auth + Edge Functions) |
| Maps         | React Leaflet + Leaflet.js                    |
| Calendar     | FullCalendar                                  |
| Export       | jsPDF, jspdf-autotable, SheetJS (xlsx)        |
| Deployment   | Docker + Nginx, Railway                       |

---

## Project Structure

```
nano-hris/
├── src/
│   ├── App.tsx                  # Root router & page titles
│   ├── main.tsx                 # Entry point
│   ├── index.css                # Global styles & Tailwind layers
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx    # Shell: sidebar + topbar + outlet
│   │   │   ├── Sidebar.tsx      # Navigation sidebar (collapsible groups)
│   │   │   └── Topbar.tsx       # Header: search, notifications, user dropdown
│   │   └── ui/
│   │       ├── index.tsx        # Shared UI: Spinner, Pagination, Modal, StatusBadge, etc.
│   │       ├── Placeholder.tsx  # "Coming soon" placeholder page
│   │       └── ProtectedRoute.tsx # Auth guard (role-based)
│   ├── hooks/
│   │   └── useAuth.tsx          # AuthContext: session, employee, signIn/Out, refreshEmployee
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client instance
│   │   └── exportCsv.ts         # exportCsv, exportXlsx, helper formatters
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── Login.tsx        # Google OAuth login page
│   │   │   ├── AuthCallback.tsx # OAuth callback handler
│   │   │   └── Unauthorized.tsx # Access denied page
│   │   ├── setup/
│   │   │   └── InitSetup.tsx    # First-run wizard (company + HR account)
│   │   ├── dashboard/
│   │   │   └── Dashboard.tsx    # Summary Report (main dashboard)
│   │   ├── attendance/
│   │   │   ├── LocationMapPage.tsx   # Real-time attendance map
│   │   │   └── IssueAttendancePage.tsx # Check-in/out log table
│   │   ├── report/
│   │   │   ├── UserReportPage.tsx    # Per-employee attendance report
│   │   │   ├── MonthlyReportPage.tsx # Monthly payroll summary
│   │   │   ├── ActivityReportPage.tsx # Date-range activity log
│   │   │   └── UserSummaryPage.tsx   # Attendance summary matrix
│   │   ├── manage/
│   │   │   ├── ShiftingPage.tsx      # Shift schedule grid + shift codes
│   │   │   ├── ApprovalPage.tsx      # Leave / overtime / correction approvals
│   │   │   ├── LeavePage.tsx         # Leave balances & categories
│   │   │   ├── CalendarPage.tsx      # Company calendar + national holidays
│   │   │   ├── NewsFeedPage.tsx      # Internal announcements
│   │   │   └── AuditTrailPage.tsx    # System audit logs
│   │   └── settings/
│   │       ├── EmployeePage.tsx      # Employee CRUD + reset password
│   │       ├── GroupsPage.tsx        # Group hierarchy + schedules
│   │       ├── HierarchyPage.tsx     # Positions, grades, employment statuses
│   │       ├── CategoryPage.tsx      # Overtime & claim categories
│   │       ├── ZonesPage.tsx         # Office zones with interactive map
│   │       ├── CompanyPage.tsx       # Company profile settings
│   │       └── MobileAppVersionPage.tsx # APK version management
│   └── types/
│       └── index.ts             # All TypeScript interfaces & types
├── supabase/
│   └── functions/
│       ├── create-employee-user/index.ts  # Edge Function: create Supabase Auth user
│       └── reset-employee-password/index.ts # Edge Function: reset user password
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── Dockerfile                   # Multi-stage: Node build → Nginx serve
├── nginx.conf                   # SPA fallback, gzip, static cache
├── .env.example                 # Required environment variables
└── tailwind.config.js
```

---

## Environment Variables

Copy `.env.example` ke `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_NAME=nano.HR
VITE_GOOGLE_CALENDAR_API_KEY=your-google-calendar-api-key
```

`VITE_GOOGLE_CALENDAR_API_KEY` digunakan di `CalendarPage.tsx` untuk fetch hari libur nasional Indonesia dari Google Calendar API.

---

## Authentication Flow

- Login menggunakan **Google OAuth** via Supabase Auth
- Setelah OAuth redirect ke `/auth/callback`, `AuthCallback.tsx` memeriksa apakah user sudah punya record di tabel `employees`
- Jika belum ada employee record sama sekali di DB → redirect ke `/setup` (first-run wizard)
- Jika sudah ada employee di DB tapi user ini belum terdaftar → redirect ke `/auth/unauthorized`
- `useAuth` hook menyimpan: `session`, `user` (Supabase Auth), `employee` (dari tabel `employees`)
- `ProtectedRoute` memeriksa role: `admin | hr | super_admin` untuk akses dashboard

**Penting:** Infinite loading yang pernah ditemui disebabkan `supabase.auth.getSession()` hang karena GoTrueClient internal lock. Solusi: membaca session langsung dari localStorage sebagai fallback jika diperlukan.

---

## Database Tables (Supabase)

| Tabel                    | Deskripsi                                                        |
| ------------------------ | ---------------------------------------------------------------- |
| `employees`              | Data karyawan + `auth_user_id` link ke Supabase Auth             |
| `groups`                 | Divisi/departemen, dengan jadwal reguler per hari                |
| `group_zones`            | Many-to-many: group ↔ zones                                      |
| `zones`                  | Zona kantor (lat, lng, radius_meters)                            |
| `attendances`            | Data absensi: time_in/out, status, GPS coords, face verification |
| `schedules`              | Jadwal shift per karyawan per tanggal                            |
| `shift_codes`            | Kode shift (code, work_in, work_out, tolerance)                  |
| `leave_requests`         | Pengajuan cuti karyawan                                          |
| `leave_balances`         | Saldo cuti per employee per tahun                                |
| `leave_categories`       | Jenis cuti (tahunan, sakit, khusus)                              |
| `overtime_requests`      | Pengajuan lembur                                                 |
| `overtime_categories`    | Kategori lembur                                                  |
| `attendance_corrections` | Pengajuan koreksi absensi                                        |
| `calendar_events`        | Event kalender perusahaan                                        |
| `news_feeds`             | Pengumuman internal                                              |
| `audit_logs`             | Log aktivitas sistem (INSERT/UPDATE/DELETE)                      |
| `companies`              | Data perusahaan (single row)                                     |
| `positions`              | Jabatan/posisi                                                   |
| `grades`                 | Grade karyawan                                                   |
| `employment_statuses`    | Status kepegawaian                                               |
| `app_versions`           | Versi APK mobile app                                             |
| `claim_categories`       | Kategori klaim                                                   |

---

## Supabase Edge Functions

### `create-employee-user`

- **Endpoint:** `POST /functions/v1/create-employee-user`
- **Caller:** Admin/HR dari `EmployeePage.tsx`
- **Flow:** Verifikasi JWT caller → cek role admin/hr/super_admin → `supabaseAdmin.auth.admin.createUser()` → return `user_id`
- **Dipakai saat:** Menambah karyawan baru dari Settings → Employee

### `reset-employee-password`

- **Endpoint:** `POST /functions/v1/reset-employee-password`
- **Caller:** Admin/HR dari `EmployeePage.tsx`
- **Flow:** Verifikasi JWT → `supabaseAdmin.auth.admin.updateUserById()` dengan password baru
- **Dipakai saat:** Reset password akun mobile karyawan

---

## Role System

| Role          | Akses                                            |
| ------------- | ------------------------------------------------ |
| `super_admin` | Full access                                      |
| `admin`       | Full access                                      |
| `hr`          | Full access                                      |
| `staff`       | Mobile app only (tidak bisa akses web dashboard) |

---

## Key Features

### Dashboard (Summary Report)

- Filter by date range, group, user
- Stats: on_time, in_tolerance, late, correction, in_location, out_location
- Table dengan date grouping
- Detail modal dengan mini map (check-in & check-out markers)
- Export CSV

### Location Map (`/attendance/location-map`)

- Real-time map update setiap 60 detik
- CircleMarker per attendance event (check-in = warna by status, check-out = orange)
- Zone overlay circles (dari tabel `zones`)
- Sidebar list dengan filter type (in/out) dan search
- FlyTo animasi saat klik item
- Stats overlay

### Shifting (`/manage/shifting`)

- Weekly grid view per karyawan
- Klik cell → assign shift per hari
- Klik nama karyawan → bulk assign seminggu
- Export template Excel (berisi jadwal yang sudah ada)
- Import dari Excel (.xlsx) dengan preview 5 baris

### Approval (`/manage/approval`)

- 3 tab: Leave Request, Overtime Request, Attendance Correction
- Approve/reject langsung dari tabel atau via modal detail
- Filter by status (pending/approved/rejected)

### Leave (`/manage/leave`)

- Tab Balance: saldo cuti per karyawan dengan progress bar
- Tab Category: CRUD kategori cuti
- Generate balance untuk semua karyawan × semua kategori (upsert, skip existing)
- Download CSV

### Reports

- **User Report:** per karyawan, dengan koordinat GPS
- **Monthly Report:** ringkasan deduction & work hours per karyawan
- **Activity Report:** log per record dengan column picker
- **User Summary:** matrix kehadiran semua karyawan
- Semua report support export CSV, PDF (jsPDF + autoTable), Excel (SheetJS)

### Zones (`/settings/zones`)

- Interactive Leaflet map untuk pick lokasi
- Address search via Nominatim (OpenStreetMap geocoding)
- Reverse geocode otomatis saat drag marker
- Draggable marker + circle radius preview

### Employee (`/settings/employee`)

- CRUD karyawan dengan form multi-section
- Saat tambah: memanggil Edge Function `create-employee-user` untuk buat Supabase Auth user
- Toggle active/inactive langsung dari tabel
- Reset password via Edge Function

### Calendar (`/manage/calendar`)

- FullCalendar dayGrid view
- Fetch hari libur nasional dari Google Calendar API (Indonesian holidays calendar)
- Cache per tahun di `holidayCache.current`
- Add/delete company events

---

## Shared UI Components (`src/components/ui/index.tsx`)

| Component          | Deskripsi                                               |
| ------------------ | ------------------------------------------------------- |
| `Spinner`          | Loading spinner                                         |
| `EmptyState`       | Empty table row                                         |
| `StatusBadge`      | Badge untuk attendance status (on_time, late, dll)      |
| `LocationBadge`    | Badge untuk location status (in_area, out_of_area, dll) |
| `Pagination`       | Table pagination dengan page size selector              |
| `Modal`            | Generic modal wrapper                                   |
| `formatTime(ts)`   | Format timestamp → HH:MM:SS                             |
| `formatDate(d)`    | Format date string → readable                           |
| `formatMinutes(m)` | Format minutes → "Xh Ym"                                |

---

## CSS Class Conventions (`src/index.css`)

Semua class Tailwind dibundel jadi utility classes via `@layer components`:

| Class                                    | Deskripsi                                                       |
| ---------------------------------------- | --------------------------------------------------------------- |
| `.btn-primary`                           | Blue filled button                                              |
| `.btn-secondary`                         | White outlined button                                           |
| `.btn-danger`                            | Red filled button                                               |
| `.btn-icon`                              | Square icon button 32×32                                        |
| `.card`                                  | White rounded card dengan border                                |
| `.form-input` / `.input`                 | Text input                                                      |
| `.form-label`                            | Input label                                                     |
| `.select`                                | Select dropdown                                                 |
| `.badge`                                 | Base badge                                                      |
| `.badge-{color}`                         | Colored badges (green, red, blue, yellow, gray, purple, orange) |
| `.nav-item` / `.nav-item-active`         | Sidebar nav buttons                                             |
| `.nav-sub-item` / `.nav-sub-item-active` | Sidebar sub-nav                                                 |
| `.data-table th/td`                      | Table header/cell styles                                        |
| `.page-title`                            | Page heading                                                    |
| `.section-label`                         | Sidebar section label                                           |

---

## Development

```bash
npm install
cp .env.example .env.local
# isi VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_GOOGLE_CALENDAR_API_KEY

npm run dev
```

## Build & Deploy

```bash
# Build lokal
npm run build

# Docker build (Railway)
docker build \
  --build-arg VITE_SUPABASE_URL=xxx \
  --build-arg VITE_SUPABASE_ANON_KEY=xxx \
  --build-arg VITE_GOOGLE_CALENDAR_API_KEY=xxx \
  -t nano-hr .
```

Deploy ke Railway menggunakan Dockerfile. Nginx serve static files dari `/usr/share/nginx/html` dengan SPA fallback (`try_files $uri /index.html`). Port dikonfigurasi via env var `$PORT`.

---

## Supabase Edge Function Deploy

```bash
supabase functions deploy create-employee-user --project-ref yftwtsyyqrvlzzebgwov
supabase functions deploy reset-employee-password --project-ref yftwtsyyqrvlzzebgwov
```

Pastikan `SUPABASE_SERVICE_ROLE_KEY` sudah di-set sebagai secret di Supabase dashboard.

---

## First-Run Setup

Jika database kosong (belum ada employee), sistem auto-redirect ke `/setup`:

1. **Welcome** — intro screen
2. **Company** — isi nama perusahaan, alamat, timezone, cutoff date → upsert ke tabel `companies` (conflict on `company_slug`)
3. **Account** — isi data HR pertama → insert ke `employees` dengan `auth_user_id` dari user yang sedang login, role `hr`
4. **Done** — redirect ke dashboard

---

## Known Issues & Notes

- `CalendarPage.tsx` memiliki `console.log("CALENDAR KEY", ...)` yang tertinggal — aman dihapus
- `scheduleFilter` di `IssueAttendancePage` belum diimplementasikan di query Supabase (hanya state UI)
- `work_amount` di `MonthlyReportPage` selalu 0 — belum ada integrasi penggajian
- `leave` count di `UserSummaryPage` selalu 0 — belum di-join dengan `leave_requests`
- `total_payroll` di summary selalu 0 — placeholder untuk fitur payroll mendatang
- Supabase project ref: `yftwtsyyqrvlzzebgwov`
- Production URL: `https://nano-absen-production.up.railway.app`
