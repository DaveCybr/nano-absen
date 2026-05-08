import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, Camera, CalendarDays, LogOut } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

const NAV_ITEMS = [
  { path: "/employee/dashboard", icon: Home, label: "Beranda" },
  { path: "/employee/attendance", icon: Camera, label: "Absensi" },
  { path: "/employee/leave", icon: CalendarDays, label: "Cuti" },
];

export default function EmployeeLayout() {
  const { employee, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/employee/login", { replace: true });
  };

  const positionName = (employee as any)?.position?.name as string | undefined;
  const groupName = (employee as any)?.group?.name as string | undefined;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white fill-current">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-gray-900">nano.HR</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-xs font-semibold text-gray-800 leading-none">
                {employee?.full_name}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-none">
                {positionName ?? groupName ?? employee?.employee_code}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
              title="Keluar"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-24">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-30 safe-area-pb">
        <div className="max-w-lg mx-auto flex">
          {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              end
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                  isActive ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
                      isActive ? "bg-blue-50" : ""
                    }`}
                  >
                    <Icon size={20} />
                  </div>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
