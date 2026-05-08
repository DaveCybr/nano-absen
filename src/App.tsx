import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";

const PAGE_TITLES: Record<string, string> = {
  "/employee/login": "Login Karyawan",
  "/employee/dashboard": "Beranda",
  "/employee/attendance": "Absensi",
  "/employee/leave": "Cuti",
  "/summary-report": "Summary Report",
  "/attendance/location-map": "Location Map",
  "/attendance/issue": "Issue Attendance",
  "/report/user": "User Report",
  "/report/monthly": "Monthly Report",
  "/report/activity": "Activity Report",
  "/report/user-summary": "User Summary",
  "/manage/shifting": "Shifting",
  "/manage/approval": "Approval",
  "/manage/leave": "Leave",
  "/manage/calendar": "Calendar",
  "/manage/news-feed": "News Feed",
  "/manage/audit-trail": "Audit Trail",
  "/settings/employee": "Employee",
  "/settings/groups": "Groups",
  "/settings/hierarchy": "Hierarchy",
  "/settings/category": "Category",
  "/settings/zones": "Zones",
  "/settings/company": "Company",
  "/settings/mobile-app": "Mobile App",
  "/auth/login": "Login",
  "/auth/unauthorized": "Unauthorized",
  "/setup": "Setup",
};

function TitleManager() {
  const { pathname } = useLocation();
  useEffect(() => {
    const title = PAGE_TITLES[pathname];
    document.title = title ? `${title} | nano.HR` : "nano.HR";
  }, [pathname]);
  return null;
}
import { AuthProvider } from "./hooks/useAuth";
import AppLayout from "./components/layout/AppLayout";
import EmployeeLayout from "./components/layout/EmployeeLayout";
import ProtectedRoute from "./components/ui/ProtectedRoute";
import EmployeeLogin from "./pages/employee/EmployeeLogin";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import EmployeeAttendance from "./pages/employee/EmployeeAttendance";
import EmployeeLeave from "./pages/employee/EmployeeLeave";
import Login from "./pages/auth/Login";
import AuthCallback from "./pages/auth/AuthCallback";
import Unauthorized from "./pages/auth/Unauthorized";
import InitSetup from "./pages/setup/InitSetup";
import Dashboard from "./pages/dashboard/Dashboard";
import EmployeePage from "./pages/settings/EmployeePage";
import GroupsPage from "./pages/settings/GroupsPage";
import HierarchyPage from "./pages/settings/HierarchyPage";
import ZonesPage from "./pages/settings/ZonesPage";
import CompanyPage from "./pages/settings/CompanyPage";
import CategoryPage from "./pages/settings/CategoryPage";
import UserReportPage from "./pages/report/UserReportPage";
import MonthlyReportPage from "./pages/report/MonthlyReportPage";
import UserSummaryPage from "./pages/report/UserSummaryPage";
import ShiftingPage from "./pages/manage/ShiftingPage";
import LeavePage from "./pages/manage/LeavePage";
import ApprovalPage from "./pages/manage/ApprovalPage";
import IssueAttendancePage from "./pages/attendance/IssueAttendancePage";
import LocationMapPage from "./pages/attendance/LocationMapPage";
import ActivityReportPage from "./pages/report/ActivityReportPage";
import NewsFeedPage from "./pages/manage/NewsFeedPage";
import AuditTrailPage from "./pages/manage/AuditTrailPage";
import CalendarPage from "./pages/manage/CalendarPage";
import MobileAppVersionPage from "./pages/settings/MobileAppVersionPage";

const adminRoles = ["admin", "hr", "super_admin"];
const staffRoles = ["staff"];

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TitleManager />
        <Routes>
          {/* Public */}
          <Route path="/auth/login" element={<Login />} />
          <Route path="/employee/login" element={<EmployeeLogin />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/unauthorized" element={<Unauthorized />} />
          <Route path="/setup" element={<InitSetup />} />

          {/* Protected */}
          <Route element={<ProtectedRoute allowedRoles={adminRoles} />}>
            <Route element={<AppLayout />}>
              <Route path="/summary-report" element={<Dashboard />} />

              {/* Attendance */}
              {/* <Route path="/summary-report" element={<SummaryReport />} /> */}
              <Route path="/attendance/location-map" element={<LocationMapPage />} />
              <Route path="/attendance/issue" element={<IssueAttendancePage />} />

              {/* Report */}
              <Route path="/report/user" element={<UserReportPage />} />
              <Route path="/report/monthly" element={<MonthlyReportPage />} />
              <Route path="/report/activity" element={<ActivityReportPage />} />
              <Route path="/report/user-summary" element={<UserSummaryPage />} />

              {/* Manage */}
              <Route path="/manage/shifting" element={<ShiftingPage />} />
              <Route path="/manage/approval" element={<ApprovalPage />} />
              <Route path="/manage/leave" element={<LeavePage />} />
              <Route path="/manage/calendar" element={<CalendarPage />} />
              <Route path="/manage/news-feed" element={<NewsFeedPage />} />
              <Route path="/manage/audit-trail" element={<AuditTrailPage />} />

              {/* Settings */}
              <Route path="/settings/employee" element={<EmployeePage />} />
              <Route path="/settings/groups" element={<GroupsPage />} />
              <Route path="/settings/hierarchy" element={<HierarchyPage />} />
              <Route path="/settings/category" element={<CategoryPage />} />
              <Route path="/settings/zones" element={<ZonesPage />} />
              <Route path="/settings/company" element={<CompanyPage />} />
              <Route path="/settings/mobile-app" element={<MobileAppVersionPage />} />
            </Route>
          </Route>

          {/* Employee portal */}
          <Route element={<ProtectedRoute allowedRoles={staffRoles} loginRedirect="/employee/login" />}>
            <Route element={<EmployeeLayout />}>
              <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
              <Route path="/employee/attendance" element={<EmployeeAttendance />} />
              <Route path="/employee/leave" element={<EmployeeLeave />} />
            </Route>
          </Route>

          <Route path="/employee" element={<Navigate to="/employee/login" replace />} />
          <Route path="/dashboard" element={<Navigate to="/summary-report" replace />} />
          <Route path="/" element={<Navigate to="/summary-report" replace />} />
          <Route path="*" element={<Navigate to="/summary-report" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
