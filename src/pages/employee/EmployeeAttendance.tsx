import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import {
  Camera, CheckCircle, XCircle, MapPin, RefreshCw,
  AlertTriangle, ArrowLeft,
} from "lucide-react";
import type { Attendance, Zone } from "../../types";

type Step =
  | "loading"
  | "done_today"
  | "ready"
  | "gps"
  | "camera_ready"
  | "camera"
  | "confirm"
  | "verifying"
  | "submitting"
  | "success"
  | "error";

const FACE_THRESHOLD = 76.5;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseScheduleTime(timeStr: string): Date {
  const [h, m, s = 0] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, s, 0);
  return d;
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

// Deteksi in-app browser (WhatsApp, LINE, Instagram, Gmail, dll) — geolocation sering diblokir di sana
const isInAppBrowser = (() => {
  const ua = navigator.userAgent;
  return /FBAN|FBAV|Instagram|Line\/|WhatsApp|Snapchat|Twitter|MicroMessenger|GSA\//.test(ua)
    || (IS_IOS && /CriOS|FxiOS/.test(ua)); // Chrome/Firefox iOS (bukan Safari)
})();

function gpsErrorMessage(code: number, fallback: string): string {
  if (code === 1) {
    return IS_IOS
      ? "Akses lokasi ditolak oleh iOS. Cek dua tempat:\n1) Pengaturan → Privasi & Keamanan → Layanan Lokasi → pastikan ON\n2) Pengaturan → Safari → Lokasi → pilih \"Izinkan Saat Menggunakan Aplikasi\""
      : "Akses lokasi ditolak. Aktifkan izin lokasi di pengaturan browser lalu coba lagi.";
  }
  if (code === 2) return "Sinyal GPS lemah. Pindah ke tempat terbuka atau dekat jendela, lalu coba lagi.";
  if (code === 3) return "Waktu habis mengambil lokasi. Pastikan GPS aktif lalu coba lagi.";
  return fallback;
}

export default function EmployeeAttendance() {
  const { employee } = useAuth();
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];

  const [step, setStep] = useState<Step>("loading");
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [schedule, setSchedule] = useState<{ work_in: string | null; work_out: string | null } | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);

  // GPS state
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [nearestZone, setNearestZone] = useState<Zone | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>("out_of_area");
  const [locationDistance, setLocationDistance] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState("");

  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const gpsWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gpsActiveRef = useRef(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState("");

  // Result state
  const [faceConfidence, setFaceConfidence] = useState<number>(0);
  const [faceError, setFaceError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const isCheckIn = !todayAttendance?.time_in;

  // Load initial data
  useEffect(() => {
    const load = async () => {
      if (!employee) return;
      const group = (employee as any).group as Record<string, any> | null;

      const [attRes, zonesRes] = await Promise.all([
        supabase
          .from("attendances")
          .select("*")
          .eq("employee_id", employee.id)
          .eq("attendance_date", today)
          .maybeSingle(),
        employee.group_id
          ? supabase
              .from("group_zones")
              .select("zone:zones(*)")
              .eq("group_id", employee.group_id)
          : Promise.resolve({ data: [] }),
      ]);

      const att = attRes.data as Attendance | null;
      setTodayAttendance(att);

      const zoneList = ((zonesRes.data || []) as any[])
        .map((gz) => gz.zone)
        .filter(Boolean) as Zone[];
      setZones(zoneList);

      // Schedule
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

      // Both check-in and check-out done
      if (att?.time_in && att?.time_out) {
        setStep("done_today");
      } else {
        setStep("ready");
      }
    };
    load();
  }, [employee, today]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (gpsWatchdogRef.current) clearTimeout(gpsWatchdogRef.current);
      gpsActiveRef.current = false;
    };
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startCamera = useCallback(async () => {
    setStep("camera");
    setCameraError("");
    setCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError("Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan di browser.");
    }
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0);
    setCapturedImage(canvas.toDataURL("image/jpeg", 0.85));
    stopCamera();
    setStep("confirm");
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setFaceError("");
    startCamera();
  };

  const cancelGps = useCallback(() => {
    gpsActiveRef.current = false;
    if (gpsWatchdogRef.current) clearTimeout(gpsWatchdogRef.current);
    setStep("ready");
  }, []);

  const startGps = useCallback(() => {
    setStep("gps");
    setGpsError("");
    gpsActiveRef.current = true;

    // Clear existing watchdog
    if (gpsWatchdogRef.current) clearTimeout(gpsWatchdogRef.current);

    if (!navigator.geolocation) {
      gpsActiveRef.current = false;
      setGpsError("Browser tidak mendukung GPS. Gunakan Safari versi terbaru.");
      setStep("ready");
      return;
    }

    // Watchdog: jika tidak ada respons dalam 18 detik, tampilkan error (silent failure di beberapa iOS)
    gpsWatchdogRef.current = setTimeout(() => {
      if (!gpsActiveRef.current) return;
      gpsActiveRef.current = false;
      setGpsError(
        IS_IOS
          ? "Lokasi tidak merespons. Pastikan:\n• Layanan Lokasi aktif (Pengaturan → Privasi & Keamanan → Layanan Lokasi)\n• Safari diizinkan (Pengaturan → Safari → Lokasi → Izinkan)"
          : "Lokasi tidak merespons. Pastikan GPS aktif dan izin lokasi sudah diberikan."
      );
      setStep("ready");
    }, 18000);

    // Panggil getCurrentPosition langsung tanpa await agar iOS tidak kehilangan user gesture context
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!gpsActiveRef.current) return;
        gpsActiveRef.current = false;
        if (gpsWatchdogRef.current) clearTimeout(gpsWatchdogRef.current);

        const { latitude, longitude } = pos.coords;
        setUserLat(latitude);
        setUserLng(longitude);

        let nearest: Zone | null = null;
        let minDist = Infinity;
        for (const z of zones) {
          const d = haversineMeters(latitude, longitude, z.latitude, z.longitude);
          if (d < minDist) { minDist = d; nearest = z; }
        }
        setNearestZone(nearest);
        setLocationDistance(nearest ? Math.round(minDist) : null);

        let status = "out_of_area";
        if (nearest) {
          if (minDist <= nearest.radius_meters) status = "in_area";
          else if (minDist <= nearest.radius_meters * 1.5) status = "tolerance";
        }
        setLocationStatus(status);
        setStep("camera_ready");
      },
      (err) => {
        if (!gpsActiveRef.current) return;
        gpsActiveRef.current = false;
        if (gpsWatchdogRef.current) clearTimeout(gpsWatchdogRef.current);
        setGpsError(gpsErrorMessage(err.code, err.message || "Gagal mendapatkan lokasi."));
        setStep("ready");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [zones]);

  const submitAttendance = async () => {
    if (!capturedImage || !employee) return;

    if (!employee.face_photo_url) {
      navigate("/employee/enroll-face");
      return;
    }

    setStep("verifying");
    setFaceError("");

    // 1. Face verification via Edge Function
    const base64 = capturedImage.replace(/^data:image\/\w+;base64,/, "");
    const { data: faceResult, error: faceErr } = await supabase.functions.invoke("verify-face", {
      body: { face_photo_url: employee.face_photo_url, image_base64: base64 },
    });

    if (faceErr || !faceResult) {
      setFaceError("Gagal verifikasi wajah. Periksa koneksi dan coba lagi.");
      setStep("confirm");
      return;
    }
    if (faceResult.error_message) {
      setFaceError(`Wajah tidak terdeteksi: ${faceResult.error_message}`);
      setStep("confirm");
      return;
    }

    const confidence: number = faceResult.confidence ?? 0;
    setFaceConfidence(confidence);

    if (confidence < FACE_THRESHOLD) {
      setFaceError(
        `Verifikasi gagal (${confidence.toFixed(1)}%). Wajah tidak cocok. Coba ambil foto ulang dengan pencahayaan yang lebih baik.`,
      );
      setStep("confirm");
      return;
    }

    // 2. Upload photo to storage (optional, non-blocking)
    setStep("submitting");
    let photoUrl: string | null = null;
    try {
      const type = isCheckIn ? "in" : "out";
      const fileName = `attendance_${employee.id}_${today}_${type}.jpg`;
      const blob = await fetch(capturedImage).then((r) => r.blob());
      const { error: uploadErr } = await supabase.storage
        .from("attendance-photos")
        .upload(fileName, blob, { contentType: "image/jpeg", upsert: true });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage
          .from("attendance-photos")
          .getPublicUrl(fileName);
        photoUrl = urlData.publicUrl;
      }
    } catch { /* photo upload is optional */ }

    // 3. Calculate status
    const now = new Date();
    const group = (employee as any).group as Record<string, any> | null;
    const toleranceMinutes = group?.tolerance_minutes ?? 15;

    if (isCheckIn) {
      let statusIn = "on_time";
      let lateMinutes = 0;
      if (schedule?.work_in) {
        const schedIn = parseScheduleTime(schedule.work_in);
        const diffMs = now.getTime() - schedIn.getTime();
        if (diffMs <= 0) statusIn = "on_time";
        else if (diffMs <= toleranceMinutes * 60 * 1000) statusIn = "in_tolerance";
        else { statusIn = "late"; lateMinutes = Math.floor(diffMs / 60000); }
      }

      const { error } = await supabase.from("attendances").upsert(
        {
          employee_id: employee.id,
          attendance_date: today,
          time_in: now.toISOString(),
          status_in: statusIn,
          location_in_status: locationStatus,
          lat_in: userLat,
          lng_in: userLng,
          zone_in_id: nearestZone?.id ?? null,
          face_verified: true,
          face_confidence: confidence,
          late_minutes: lateMinutes,
          ...(photoUrl ? { photo_in_url: photoUrl } : {}),
        },
        { onConflict: "employee_id,attendance_date" },
      );

      if (error) { setErrorMsg("Gagal menyimpan: " + error.message); setStep("error"); return; }
      setSuccessMsg(statusIn === "on_time" ? "Check in berhasil! Tepat waktu." : statusIn === "in_tolerance" ? "Check in berhasil! Masih dalam toleransi." : `Check in berhasil! Terlambat ${lateMinutes} menit.`);
    } else {
      // Check-out
      let statusOut = "on_time";
      let workMinutes = 0;
      if (schedule?.work_out) {
        const schedOut = parseScheduleTime(schedule.work_out);
        if (now < schedOut) statusOut = "early_check_out";
      }
      if (todayAttendance?.time_in) {
        workMinutes = Math.floor((now.getTime() - new Date(todayAttendance.time_in).getTime()) / 60000);
      }

      const { error } = await supabase
        .from("attendances")
        .update({
          time_out: now.toISOString(),
          status_out: statusOut,
          location_out_status: locationStatus,
          lat_out: userLat,
          lng_out: userLng,
          zone_out_id: nearestZone?.id ?? null,
          work_minutes: workMinutes,
        })
        .eq("id", todayAttendance!.id);

      if (error) { setErrorMsg("Gagal menyimpan: " + error.message); setStep("error"); return; }
      const h = Math.floor(workMinutes / 60);
      const m = workMinutes % 60;
      setSuccessMsg(`Check out berhasil! Durasi kerja ${h}j ${m}m.`);
    }

    // Refresh local attendance data
    const { data: updated } = await supabase
      .from("attendances")
      .select("*")
      .eq("employee_id", employee.id)
      .eq("attendance_date", today)
      .maybeSingle();
    setTodayAttendance(updated as Attendance | null);
    setStep("success");
  };

  const locationBadge = () => {
    if (locationStatus === "in_area") return { label: `Dalam area (${locationDistance}m)`, cls: "bg-green-50 text-green-700" };
    if (locationStatus === "tolerance") return { label: `Batas area (${locationDistance}m)`, cls: "bg-yellow-50 text-yellow-700" };
    return { label: nearestZone ? `Di luar area (${locationDistance}m dari ${nearestZone.office_name})` : "Di luar area", cls: "bg-red-50 text-red-700" };
  };

  // ─── Render helpers ───

  if (step === "loading") {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (step === "done_today") {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-900 pt-1">Absensi</h1>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Absensi Hari Ini Selesai</h2>
          <p className="text-sm text-gray-500">
            Kamu sudah check in dan check out hari ini. Sampai jumpa besok!
          </p>
          <button onClick={() => navigate("/employee/dashboard")} className="btn-secondary mt-2">
            <ArrowLeft size={14} /> Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  if (step === "ready" && !employee?.face_photo_url) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-900 pt-1">Absensi</h1>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center">
            <AlertTriangle size={28} className="text-yellow-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Wajah Belum Terdaftar</h2>
            <p className="text-sm text-gray-500 mt-1">
              Kamu perlu mendaftarkan wajah terlebih dahulu sebelum bisa melakukan absensi.
            </p>
          </div>
          <button
            onClick={() => navigate("/employee/enroll-face")}
            className="btn-primary w-full justify-center"
          >
            Daftar Wajah Sekarang
          </button>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-900 pt-1">Absensi</h1>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Berhasil!</h2>
          <p className="text-sm text-gray-600">{successMsg}</p>
          {faceConfidence > 0 && (
            <p className="text-xs text-gray-400">Face match: {faceConfidence.toFixed(1)}%</p>
          )}
          <button
            onClick={() => navigate("/employee/dashboard")}
            className="btn-primary mt-2"
          >
            Ke Beranda
          </button>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-900 pt-1">Absensi</h1>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
            <XCircle size={32} className="text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Absensi Gagal</h2>
          <p className="text-sm text-red-600">{errorMsg}</p>
          <button onClick={() => setStep("ready")} className="btn-secondary mt-2">
            <RefreshCw size={14} /> Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900 pt-1">Absensi</h1>

      {/* Status card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Status Hari Ini
        </p>
        <div className="flex gap-3">
          <div className={`flex-1 rounded-xl p-3 text-center ${todayAttendance?.time_in ? "bg-green-50" : "bg-gray-50"}`}>
            <p className="text-[10px] text-gray-500 font-semibold">MASUK</p>
            <p className="text-sm font-bold text-gray-800 mt-1">
              {todayAttendance?.time_in
                ? new Date(todayAttendance.time_in).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
                : "--:--"}
            </p>
          </div>
          <div className={`flex-1 rounded-xl p-3 text-center ${todayAttendance?.time_out ? "bg-blue-50" : "bg-gray-50"}`}>
            <p className="text-[10px] text-gray-500 font-semibold">PULANG</p>
            <p className="text-sm font-bold text-gray-800 mt-1">
              {todayAttendance?.time_out
                ? new Date(todayAttendance.time_out).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
                : "--:--"}
            </p>
          </div>
        </div>
      </div>

      {/* In-app browser warning (WhatsApp, Gmail, dll) */}
      {isInAppBrowser && step === "ready" && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-orange-800">Buka di Safari untuk absensi</p>
            <p className="text-xs text-orange-700 mt-0.5">
              Browser in-app (WhatsApp, Gmail, dll.) memblokir akses lokasi.
              Ketuk ikon <span className="font-bold">⋯</span> atau <span className="font-bold">↗</span> lalu pilih <span className="font-bold">"Buka di Safari"</span>.
            </p>
          </div>
        </div>
      )}

      {/* GPS step */}
      {(step === "ready" || step === "gps") && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center text-center gap-4">
          {step === "gps" ? (
            <>
              <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
                <MapPin size={24} className="text-blue-500 animate-pulse" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Mengambil lokasi...</p>
                <p className="text-sm text-gray-500 mt-1">
                  {IS_IOS
                    ? "Ketuk \"Izinkan\" pada popup yang muncul dari iOS."
                    : "Izinkan akses lokasi pada popup browser."}
                </p>
              </div>
              <button onClick={cancelGps} className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2">
                Batalkan
              </button>
            </>
          ) : (
            <>
              <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
                <Camera size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">
                  {isCheckIn ? "Absen Masuk" : "Absen Pulang"}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Klik tombol di bawah untuk memulai. Kamu akan diminta izin lokasi dan kamera.
                </p>
                {schedule && (
                  <p className="text-xs text-gray-400 mt-2">
                    Jadwal: {schedule.work_in?.slice(0, 5)} – {schedule.work_out?.slice(0, 5)}
                  </p>
                )}
              </div>
              {gpsError && (
                <div className="w-full bg-red-50 rounded-xl p-4 text-left space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 font-medium whitespace-pre-line">{gpsError}</p>
                  </div>
                  {IS_IOS && (
                    <div className="bg-white rounded-lg p-3 space-y-2 border border-red-100">
                      <p className="text-[11px] font-semibold text-gray-700">Langkah mengaktifkan lokasi di iPhone:</p>
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold text-blue-700">① Cek Layanan Lokasi (wajib aktif):</p>
                        {[
                          "Buka Pengaturan → Privasi & Keamanan",
                          "Pilih Layanan Lokasi",
                          "Pastikan tombol hijau (ON)",
                        ].map((s, i) => (
                          <div key={i} className="flex items-start gap-1.5 pl-2">
                            <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">•</span>
                            <p className="text-[11px] text-gray-600">{s}</p>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold text-blue-700">② Izin Safari:</p>
                        {[
                          "Buka Pengaturan → Safari",
                          "Pilih Lokasi",
                          'Pilih "Izinkan Saat Menggunakan Aplikasi"',
                          "Kembali ke sini dan coba lagi",
                        ].map((s, i) => (
                          <div key={i} className="flex items-start gap-1.5 pl-2">
                            <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">•</span>
                            <p className="text-[11px] text-gray-600">{s}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button onClick={startGps} className="btn-primary w-full justify-center">
                <MapPin size={15} />
                {isCheckIn ? "Mulai Absen Masuk" : "Mulai Absen Pulang"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Camera ready step — tombol terpisah agar getUserMedia dipanggil langsung dari user gesture */}
      {step === "camera_ready" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className={`px-4 py-2 text-xs font-medium flex items-center gap-1.5 ${locationBadge().cls}`}>
            <MapPin size={12} />
            {locationBadge().label}
          </div>
          <div className="p-6 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center">
              <CheckCircle size={24} className="text-green-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">Lokasi didapat!</p>
              <p className="text-sm text-gray-500 mt-1">
                Sekarang buka kamera untuk verifikasi wajah.
              </p>
            </div>
            <button onClick={startCamera} className="btn-primary w-full justify-center">
              <Camera size={15} /> Buka Kamera
            </button>
          </div>
        </div>
      )}

      {/* Camera step */}
      {step === "camera" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Location badge */}
          {userLat !== null && (
            <div className={`px-4 py-2 text-xs font-medium flex items-center gap-1.5 ${locationBadge().cls}`}>
              <MapPin size={12} />
              {locationBadge().label}
            </div>
          )}

          {/* Camera preview */}
          {cameraError ? (
            <div className="p-6 text-center space-y-3">
              <XCircle size={32} className="text-red-400 mx-auto" />
              <p className="text-sm text-red-600">{cameraError}</p>
              <button onClick={startCamera} className="btn-secondary">
                <RefreshCw size={14} /> Coba Lagi
              </button>
            </div>
          ) : (
            <>
              <div className="relative bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full aspect-[4/3] object-cover"
                />
                {/* Face guide overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-56 border-2 border-white/60 rounded-[40%] opacity-60" />
                </div>
              </div>
              <div className="p-4">
                <p className="text-xs text-gray-500 text-center mb-3">
                  Posisikan wajah di dalam lingkaran
                </p>
                <button onClick={capturePhoto} className="btn-primary w-full justify-center">
                  <Camera size={16} /> Ambil Foto
                </button>
              </div>
            </>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Confirm step */}
      {step === "confirm" && capturedImage && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Location badge */}
          {userLat !== null && (
            <div className={`px-4 py-2 text-xs font-medium flex items-center gap-1.5 ${locationBadge().cls}`}>
              <MapPin size={12} />
              {locationBadge().label}
            </div>
          )}

          <div className="p-4 space-y-4">
            <img
              src={capturedImage}
              alt="Captured"
              className="w-full aspect-[4/3] object-cover rounded-xl"
            />

            {faceError && (
              <div className="p-3 bg-red-50 rounded-lg flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{faceError}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button onClick={retakePhoto} className="btn-secondary justify-center">
                <RefreshCw size={14} /> Foto Ulang
              </button>
              <button onClick={submitAttendance} className="btn-primary justify-center">
                <CheckCircle size={14} /> Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verifying / submitting step */}
      {(step === "verifying" || step === "submitting") && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col items-center gap-4">
          <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
            <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-800">
              {step === "verifying" ? "Memverifikasi wajah..." : "Menyimpan absensi..."}
            </p>
            <p className="text-sm text-gray-500 mt-1">Mohon tunggu sebentar</p>
          </div>
        </div>
      )}
    </div>
  );
}
