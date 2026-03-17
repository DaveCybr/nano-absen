// ─── Auth & Employee ───────────────────────────────────────────────────────

export type AccessType = 'staff' | 'admin' | 'hr' | 'super_admin'
export type WorkingStatus = 'active' | 'inactive' | 'resigned' | 'terminated'

export interface Employee {
  id: string
  auth_user_id: string | null
  group_id: string | null
  position_id: string | null
  grade_id: string | null
  employment_status_id: string | null
  employee_code: string
  full_name: string
  email: string
  phone: string | null
  face_photo_url: string | null
  access_type: AccessType
  working_status: WorkingStatus
  is_active: boolean
  join_date: string | null
  created_at: string
  // joins
  group?: Group
  position?: Position
}

// ─── Organization ─────────────────────────────────────────────────────────

export interface Group {
  id: string
  parent_group_id: string | null
  name: string
  level: number
  schedule_type: 'regular' | 'shifting'
  mandatory_checkout: boolean
  strict_area_in: boolean
  strict_area_out: boolean
  tolerance_minutes: number
  timezone: string
  created_at: string
}

export interface Zone {
  id: string
  office_name: string
  office_address: string | null
  latitude: number
  longitude: number
  radius_meters: number
  created_at: string
}

export interface Position {
  id: string
  code: string
  name: string
}

export interface Grade {
  id: string
  code: string
  name: string
}

export interface EmploymentStatus {
  id: string
  name_id: string
  name_en: string
}

// ─── Shift ─────────────────────────────────────────────────────────────────

export interface ShiftCode {
  id: string
  code: string
  title: string
  work_in: string | null
  work_out: string | null
  tolerance_minutes: number
  is_holiday: boolean
}

export interface Schedule {
  id: string
  employee_id: string
  shift_code_id: string
  schedule_date: string
  employee?: Employee
  shift_code?: ShiftCode
}

// ─── Attendance ────────────────────────────────────────────────────────────

export type AttendanceStatus = 'on_time' | 'late' | 'in_tolerance' | 'early_check_out' | 'others'
export type LocationStatus = 'in_area' | 'out_of_area' | 'meeting' | 'tolerance' | 'correction'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface Attendance {
  id: string
  employee_id: string
  zone_in_id: string | null
  zone_out_id: string | null
  attendance_date: string
  time_in: string | null
  time_out: string | null
  status_in: AttendanceStatus | null
  status_out: AttendanceStatus | null
  location_in_status: LocationStatus | null
  location_out_status: LocationStatus | null
  lat_in: number | null
  lng_in: number | null
  lat_out: number | null
  lng_out: number | null
  reason_in: string | null
  reason_out: string | null
  note_in: string | null
  note_out: string | null
  face_verified: boolean
  face_confidence: number | null
  work_minutes: number
  late_minutes: number
  overtime_minutes: number
  deduction_amount: number
  created_at: string
  employee?: Employee
  zone_in?: Zone
}

// ─── Leave ─────────────────────────────────────────────────────────────────

export interface LeaveCategory {
  id: string
  leave_type: string
  leave_name: string
  limit_per_year: number | null
  amount_per_taken: 'as_requested' | 'fixed'
  approval_level: number
}

export interface LeaveBalance {
  id: string
  employee_id: string
  leave_category_id: string
  year: number
  annual_taken: number
  other_taken: number
  employee?: Employee
  leave_category?: LeaveCategory
}

export interface LeaveRequest {
  id: string
  employee_id: string
  leave_category_id: string
  start_date: string
  end_date: string
  total_days: number
  reason: string | null
  status: ApprovalStatus
  approved_by: string | null
  approved_at: string | null
  created_at: string
  employee?: Employee
  leave_category?: LeaveCategory
}

// ─── Company ───────────────────────────────────────────────────────────────

export interface Company {
  id: string
  name: string
  company_slug: string
  logo_url: string | null
  phone: string | null
  email: string | null
  address: string | null
  timezone: string
  cutoff_date: number
  plan_type: string | null
  plan_start: string | null
  plan_end: string | null
  pic_email: string | null
}

// ─── UI Helpers ───────────────────────────────────────────────────────────

export interface NavItem {
  label: string
  path: string
  icon: string
  children?: NavItem[]
}
