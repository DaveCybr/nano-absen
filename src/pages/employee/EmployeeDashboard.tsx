import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { formatTime } from "../../components/ui";
import { Camera, CheckCircle, AlertTriangle } from "lucide-react";
import type { Attendance } from "../../types";

interface TodaySchedule {
  work_in: string | null;
  work_out: string | null;
}

interface MonthlySummary {
  total_present: number;
  on_time: number;
  late: number;
  total_work_minutes: number;
}

interface RecentRow {
  attendance_date: string;
  time_in: string | null;
  time_out: string | null;
  status_in: string | null;
  work_minutes: number;
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}j ${min}m` : `${min}m`;
}

function statusColor(s: string | null): string {
  if (s === "on_time") return "text-green-600";
  if (s === "in_tolerance") return "text-yellow-600";
  if (s === "late" || s === "early_check_out") return "text-red-600";
  return "text-gray-400";
}

function statusLabel(s: string | null): string {
  if (s === "on_time") return "Tepat Waktu";
  if (s === "in_tolerance") return "Toleransi";
  if (s === "late") return "Terlambat";
  if (s === "early_check_out") return "Pulang Awal";
  return "-";
}

function dotColor(s: string | null): string {
  if (s === "on_time") return "bg-green-400";
  if (s === "in_tolerance") return "bg-yellow-400";
  if (s === "late") return "bg-red-400";
  return "bg-gray-200";
}

export default function EmployeeDashboard() {
  const { employee } = useAuth();
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];

  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [schedule, setSchedule] = useState<TodaySchedule | null>(null);
  const [monthly, setMonthly] = useState<MonthlySummary>({
    total_present: 0, on_time: 0, late: 0, total_work_minutes: 0,
  });
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!employee) return;
    setLoading(true);
    try {
      const group = (employee as any).group as Record<string, any> | null;

      // Today's attendance
      const { data: att } = await supabase
        .from("attendances")
        .select("*")
        .eq("employee_id", employee.id)
        .eq("attendance_date", today)
        .maybeSingle();
      setTodayAttendance(att as Attendance | null);

      // Today's schedule
      if (group?.schedule_type === "shifting") {
        const { data: sched } = await supabase
          .from("schedules")
          .select("shift_code:shift_codes(work_in, work_out)")
          .eq("employee_id", employee.id)
          .eq("schedule_date", today)
          .maybeSingle();
        const sc = (sched as any)?.shift_code;
        if (sc) setSchedule({ work_in: sc.work_in ?? null, work_out: sc.work_out ?? null });
      } else if (group) {
        const dayKey = DAY_KEYS[new Date().getDay()];
        setSchedule({
          work_in: group[`schedule_in_${dayKey}`] ?? null,
          work_out: group[`schedule_out_${dayKey}`] ?? null,
        });
      }

      // Monthly summary
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString().split("T")[0];
      const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString().split("T")[0];
      const { data: monthAtts } = await supabase
        .from("attendances")
        .select("status_in, time_out, work_minutes")
        .eq("employee_id", employee.id)
        .gte("attendance_date", firstOfMonth)
        .lte("attendance_date", lastOfMonth);
      if (monthAtts) {
        setMonthly({
          total_present: monthAtts.filter((r: any) => r.time_out).length,
          on_time: monthAtts.filter((r: any) => r.status_in === "on_time").length,
          late: monthAtts.filter((r: any) => r.status_in === "late").length,
          total_work_minutes: monthAtts.reduce((s: number, r: any) => s + (r.work_minutes || 0), 0),
        });
      }

      // Recent 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const { data: recentAtts } = await supabase
        .from("attendances")
        .select("attendance_date, time_in, time_out, status_in, work_minutes")
        .eq("employee_id", employee.id)
        .gte("attendance_date", sevenDaysAgo.toISOString().split("T")[0])
        .order("attendance_date", { ascending: false });
      setRecent((recentAtts || []) as RecentRow[]);
    } finally {
      setLoading(false);
    }
  }, [employee, today]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Selamat Pagi" : hour < 15 ? "Selamat Siang" : hour < 18 ? "Selamat Sore" : "Selamat Malam";

  const checkedIn = !!todayAttendance?.time_in;
  const checkedOut = !!todayAttendance?.time_out;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Banner wajah belum terdaftar */}
      {!employee?.face_photo_url && (
        <button
          onClick={() => navigate("/employee/enroll-face")}
          className="w-full flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-left hover:bg-yellow-100 transition-colors"
        >
          <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center shrink-0">
            <AlertTriangle size={16} className="text-yellow-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-yellow-800">Wajah belum terdaftar</p>
            <p className="text-xs text-yellow-600">Daftar sekarang untuk bisa absensi →</p>
          </div>
        </button>
      )}

      {/* Greeting */}
      <div className="pt-1">
        <p className="text-sm text-gray-500">{greeting},</p>
        <h1 className="text-xl font-bold text-gray-900">{employee?.full_name}</h1>
        <p className="text-xs text-gray-400">
          {(employee as any)?.position?.name ?? ""}
          {(employee as any)?.group?.name ? ` · ${(employee as any).group.name}` : ""}
        </p>
      </div>

      {/* Today attendance card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-50">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Hari Ini</p>
              <p className="text-sm font-semibold text-gray-800">
                {new Date().toLocaleDateString("id-ID", {
                  weekday: "long", day: "numeric", month: "long",
                })}
              </p>
            </div>
            {schedule && (
              <div className="text-right">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Jadwal</p>
                <p className="text-sm font-mono font-semibold text-gray-700">
                  {schedule.work_in?.slice(0, 5) ?? "--:--"}
                  {" – "}
                  {schedule.work_out?.slice(0, 5) ?? "--:--"}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Check In */}
            <div className={`rounded-xl p-3 ${checkedIn ? "bg-green-50" : "bg-gray-50"}`}>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-1">Masuk</p>
              {checkedIn ? (
                <>
                  <p className="text-lg font-bold font-mono text-gray-900">
                    {formatTime(todayAttendance!.time_in)}
                  </p>
                  <p className={`text-xs font-medium mt-0.5 ${statusColor(todayAttendance!.status_in)}`}>
                    {statusLabel(todayAttendance!.status_in)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400">Belum absen</p>
              )}
            </div>

            {/* Check Out */}
            <div className={`rounded-xl p-3 ${checkedOut ? "bg-blue-50" : "bg-gray-50"}`}>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-1">Pulang</p>
              {checkedOut ? (
                <>
                  <p className="text-lg font-bold font-mono text-gray-900">
                    {formatTime(todayAttendance!.time_out)}
                  </p>
                  <p className="text-xs font-medium mt-0.5 text-blue-600">
                    {fmtMinutes(todayAttendance!.work_minutes)} kerja
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400">Belum absen</p>
              )}
            </div>
          </div>
        </div>

        {/* Action */}
        {!checkedOut ? (
          <button
            onClick={() => navigate("/employee/attendance")}
            className="w-full p-3.5 flex items-center justify-center gap-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Camera size={16} />
            {!checkedIn ? "Absen Masuk Sekarang" : "Absen Pulang Sekarang"}
          </button>
        ) : (
          <div className="p-3 flex items-center justify-center gap-2 text-sm text-green-600 font-medium">
            <CheckCircle size={15} />
            Absensi hari ini selesai
          </div>
        )}
      </div>

      {/* Monthly summary */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Bulan Ini</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Total Hadir", value: monthly.total_present, color: "text-blue-600" },
            { label: "Tepat Waktu", value: monthly.on_time, color: "text-green-600" },
            { label: "Terlambat", value: monthly.late, color: "text-red-600" },
            { label: "Jam Kerja", value: fmtMinutes(monthly.total_work_minutes), color: "text-gray-800" },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
              <p className="text-xs text-gray-400">{item.label}</p>
              <p className={`text-xl font-bold mt-0.5 ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent 7 days */}
      {recent.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            7 Hari Terakhir
          </p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {recent.map((r) => (
              <div key={r.attendance_date} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${r.time_in ? dotColor(r.status_in) : "bg-gray-200"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {new Date(r.attendance_date + "T00:00:00").toLocaleDateString("id-ID", {
                      weekday: "short", day: "numeric", month: "short",
                    })}
                  </p>
                  <p className="text-xs text-gray-400">
                    {r.time_in
                      ? `${formatTime(r.time_in)} – ${r.time_out ? formatTime(r.time_out) : "..."}`
                      : "Tidak hadir"}
                  </p>
                </div>
                {r.work_minutes > 0 && (
                  <span className="text-xs text-gray-500 shrink-0">{fmtMinutes(r.work_minutes)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
