import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import AppLayout from './components/layout/AppLayout'
import ProtectedRoute from './components/ui/ProtectedRoute'
import Placeholder from './components/ui/Placeholder'
import Login from './pages/auth/Login'
import AuthCallback from './pages/auth/AuthCallback'
import Unauthorized from './pages/auth/Unauthorized'
import InitSetup from './pages/setup/InitSetup'
import Dashboard from './pages/dashboard/Dashboard'

const adminRoles = ['admin', 'hr', 'super_admin']

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/unauthorized" element={<Unauthorized />} />
          <Route path="/setup" element={<InitSetup />} />

          <Route element={<ProtectedRoute allowedRoles={adminRoles} />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/summary-report" element={<Placeholder title="Summary Report" />} />
              <Route path="/attendance/location-map" element={<Placeholder title="Location Map" />} />
              <Route path="/attendance/issue" element={<Placeholder title="Issue Attendance" />} />
              <Route path="/report/user" element={<Placeholder title="User Report" />} />
              <Route path="/report/monthly" element={<Placeholder title="Monthly Report" />} />
              <Route path="/report/activity" element={<Placeholder title="Activity Report" />} />
              <Route path="/report/user-summary" element={<Placeholder title="User Summary" />} />
              <Route path="/manage/shifting" element={<Placeholder title="Shifting" />} />
              <Route path="/manage/approval" element={<Placeholder title="Approval" />} />
              <Route path="/manage/leave" element={<Placeholder title="Leave" />} />
              <Route path="/manage/calendar" element={<Placeholder title="Calendar" />} />
              <Route path="/manage/news-feed" element={<Placeholder title="News Feed" />} />
              <Route path="/manage/audit-trail" element={<Placeholder title="Audit Trail" />} />
              <Route path="/settings/employee" element={<Placeholder title="Employee" />} />
              <Route path="/settings/groups" element={<Placeholder title="Groups" />} />
              <Route path="/settings/hierarchy" element={<Placeholder title="Hierarchy" />} />
              <Route path="/settings/category" element={<Placeholder title="Category" />} />
              <Route path="/settings/zones" element={<Placeholder title="Zones" />} />
              <Route path="/settings/company" element={<Placeholder title="Company" />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
