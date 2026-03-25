import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  LogOut,
  User,
  ChevronDown,
  AlertCircle,
  Calendar,
  Clock,
  Edit2,
  X,
  CheckCircle,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";

interface NotifItem {
  id: string;
  type: "leave" | "overtime" | "correction" | "late";
  employeeName: string;
  description: string;
  subDescription?: string;
}

interface NotifState {
  pendingApprovals: NotifItem[];
  lateToday: NotifItem[];
  loading: boolean;
}

export default function Topbar() {
  const { employee, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Notification state
  const [badgeCount, setBadgeCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [notif, setNotif] = useState<NotifState>({
    pendingApprovals: [],
    lateToday: [],
    loading: false,
  });
  const bellRef = useRef<HTMLDivElement>(null);

  // Close user dropdown on outside click
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

  // Close bell dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node))
        setBellOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchBadgeCount = useCallback(async () => {
    const [{ count: l }, { count: o }, { count: c }] = await Promise.all([
      supabase
        .from("leave_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("overtime_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("attendance_corrections")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);
    setBadgeCount((l || 0) + (o || 0) + (c || 0));
  }, []);

  // Badge fetch on mount + every 5 min
  useEffect(() => {
    fetchBadgeCount();
    const interval = setInterval(fetchBadgeCount, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchBadgeCount]);

  const fetchNotifications = useCallback(async () => {
    setNotif((prev) => ({ ...prev, loading: true }));

    const today = new Date().toISOString().split("T")[0];

    const [
      { data: leaves },
      { data: overtimes },
      { data: corrections },
      { data: lates },
    ] = await Promise.all([
      supabase
        .from("leave_requests")
        .select(
          "id, reason, total_days, created_at, leave_category:leave_categories(leave_name), employee:employees(full_name)",
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("overtime_requests")
        .select(
          "id, overtime_date, total_minutes, created_at, overtime_category:overtime_categories(code), employee:employees(full_name)",
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("attendance_corrections")
        .select(
          "id, created_at, employee:employees(full_name), attendance:attendances(attendance_date)",
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("attendances")
        .select("id, time_in, employee:employees(full_name)")
        .eq("attendance_date", today)
        .eq("status_in", "late")
        .order("time_in", { ascending: true })
        .limit(15),
    ]);

    const pendingApprovals: NotifItem[] = [
      ...(leaves || []).map((l: any) => ({
        id: `leave-${l.id}`,
        type: "leave" as const,
        employeeName: l.employee?.full_name ?? "-",
        description: `${l.employee?.full_name ?? "-"} mengajukan cuti`,
        subDescription: `${l.leave_category?.leave_name ?? "Cuti"} · ${l.total_days ?? "-"} hari`,
      })),
      ...(overtimes || []).map((o: any) => {
        const hours = o.total_minutes ? Math.round(o.total_minutes / 60) : "-";
        return {
          id: `overtime-${o.id}`,
          type: "overtime" as const,
          employeeName: o.employee?.full_name ?? "-",
          description: `${o.employee?.full_name ?? "-"} mengajukan lembur`,
          subDescription: `${o.overtime_category?.code ?? "-"} · ${o.overtime_date ?? "-"} · ${hours} jam`,
        };
      }),
      ...(corrections || []).map((c: any) => ({
        id: `correction-${c.id}`,
        type: "correction" as const,
        employeeName: c.employee?.full_name ?? "-",
        description: `${c.employee?.full_name ?? "-"} koreksi absensi`,
        subDescription: c.attendance?.attendance_date ?? "-",
      })),
    ];

    const lateToday: NotifItem[] = (lates || []).map((a: any) => {
      const timeIn = a.time_in
        ? new Date(`1970-01-01T${a.time_in}`).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }) + " WIB"
        : "-";
      return {
        id: `late-${a.id}`,
        type: "late" as const,
        employeeName: a.employee?.full_name ?? "-",
        description: a.employee?.full_name ?? "-",
        subDescription: `Terlambat · ${timeIn}`,
      };
    });

    setNotif({ pendingApprovals, lateToday, loading: false });
    setBadgeCount(pendingApprovals.length);
  }, []);

  const handleBellClick = () => {
    const opening = !bellOpen;
    setBellOpen(opening);
    if (opening) {
      fetchBadgeCount();
      fetchNotifications();
    }
  };

  const handleNotifClick = (item: NotifItem) => {
    setBellOpen(false);
    if (item.type === "late") {
      navigate("/summary-report");
    } else {
      navigate("/manage/approval");
    }
  };

  const displayName =
    employee?.full_name || user?.user_metadata?.full_name || "Admin";
  const displayEmail = user?.email || "";
  const initials = (displayName || "Ad").slice(0, 2).toUpperCase();

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
          {/* <span className="text-xs text-gray-300 mx-1 hidden sm:block">|</span>
          <span className="text-xs text-gray-500 hidden sm:block">English</span> */}

          {/* Bell */}
          <div className="relative ml-1" ref={bellRef}>
            <button className="btn-icon relative" onClick={handleBellClick}>
              <Bell size={16} />
              {badgeCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </button>

            {bellOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-50">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-800">
                    Notifikasi
                  </span>
                  <button
                    onClick={() => setBellOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="max-h-[480px] overflow-y-auto">
                  {notif.loading ? (
                    <div className="flex items-center justify-center py-10">
                      <span className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : notif.pendingApprovals.length === 0 &&
                    notif.lateToday.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <CheckCircle size={28} className="text-green-400" />
                      <span className="text-sm text-gray-400">
                        Semua sudah ditangani
                      </span>
                    </div>
                  ) : (
                    <>
                      {notif.pendingApprovals.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between px-4 pt-3 pb-1">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                              Perlu Tindakan
                            </span>
                            <span className="text-xs font-bold text-blue-500">
                              {notif.pendingApprovals.length}
                            </span>
                          </div>
                          {notif.pendingApprovals.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => handleNotifClick(item)}
                              className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 text-left"
                            >
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                  item.type === "leave"
                                    ? "bg-blue-50"
                                    : item.type === "overtime"
                                      ? "bg-purple-50"
                                      : "bg-orange-50"
                                }`}
                              >
                                {item.type === "leave" && (
                                  <Calendar
                                    size={14}
                                    className="text-blue-500"
                                  />
                                )}
                                {item.type === "overtime" && (
                                  <Clock
                                    size={14}
                                    className="text-purple-500"
                                  />
                                )}
                                {item.type === "correction" && (
                                  <Edit2
                                    size={14}
                                    className="text-orange-500"
                                  />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-gray-800 leading-snug truncate">
                                  {item.description}
                                </p>
                                {item.subDescription && (
                                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                                    {item.subDescription}
                                  </p>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {notif.lateToday.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between px-4 pt-3 pb-1">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                              Terlambat Hari Ini
                            </span>
                            <span className="text-xs font-bold text-red-500">
                              {notif.lateToday.length}
                            </span>
                          </div>
                          {notif.lateToday.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => handleNotifClick(item)}
                              className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 text-left"
                            >
                              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
                                <AlertCircle
                                  size={14}
                                  className="text-red-500"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-gray-800 leading-snug truncate">
                                  {item.description}
                                </p>
                                {item.subDescription && (
                                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                                    {item.subDescription}
                                  </p>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

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
