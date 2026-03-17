import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  LogOut,
  User,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

export default function Topbar() {
  const { employee, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      )
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const displayName =
    employee?.full_name || user?.user_metadata?.full_name || "Admin";
  const displayEmail = user?.email || "";
  const initials = displayName.slice(0, 2).toUpperCase();

  const roleLabel: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    hr: "HR",
    staff: "Staff",
  };
  const role = employee?.access_type ? roleLabel[employee.access_type] : "HR";

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      navigate("/auth/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
      setLogoutOpen(false);
    }
  };

  return (
    <>
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-5 gap-4 shrink-0">
        {/* Search */}
        <div className="flex-1 flex items-center gap-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Cari..."
              className="pl-8 pr-4 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Plan badge */}
          <span className="text-xs text-gray-400 font-medium hidden sm:block">
            Umkm
          </span>
          <span className="badge badge-blue text-[10px] hidden sm:flex">
            246 days left
          </span>
          <span className="text-xs text-gray-300 mx-1 hidden sm:block">|</span>
          <span className="text-xs text-gray-500 hidden sm:block">English</span>

          {/* Bell */}
          <button className="btn-icon relative ml-1">
            <Bell size={16} />
          </button>

          {/* User dropdown */}
          <div className="relative ml-1" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((p) => !p)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{initials}</span>
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-gray-800 leading-tight">
                  {role}
                </p>
              </div>
              <ChevronDown size={14} className="text-gray-400" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50">
                <div className="px-4 py-3 border-b border-gray-50">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {displayName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {displayEmail}
                  </p>
                  <span className="badge badge-blue mt-1.5">{role}</span>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => {
                      navigate("/settings/employee");
                      setDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <User size={14} className="text-gray-400" /> Profil Saya
                  </button>
                  <button
                    onClick={() => {
                      setLogoutOpen(true);
                      setDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut size={14} /> Keluar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Logout Dialog */}
      {logoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-96">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
                <AlertCircle size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  Keluar dari Aplikasi?
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Anda akan keluar dari aplikasi. Anda perlu login kembali untuk
                  mengakses.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setLogoutOpen(false)}
                disabled={isLoggingOut}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmLogout}
                disabled={isLoggingOut}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {isLoggingOut ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sedang keluar...
                  </>
                ) : (
                  "Ya, Keluar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
