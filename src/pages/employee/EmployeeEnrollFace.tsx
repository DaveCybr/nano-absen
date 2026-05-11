import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { Camera, CheckCircle, RefreshCw, AlertTriangle, UserCheck } from "lucide-react";

type Step = "intro" | "camera_ready" | "camera" | "confirm" | "processing" | "success" | "error";

export default function EmployeeEnrollFace() {
  const { employee, refreshEmployee } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("intro");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isReenroll = !!employee?.face_photo_url;

  useEffect(() => {
    return () => stopCamera();
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
      setCameraError("Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan.");
    }
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0);
    setCapturedImage(canvas.toDataURL("image/jpeg", 0.9));
    stopCamera();
    setStep("confirm");
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const submitEnrollment = async () => {
    if (!capturedImage || !employee) return;
    setStep("processing");
    setErrorMsg("");

    const base64 = capturedImage.replace(/^data:image\/\w+;base64,/, "");

    // 1. Detect face via Edge Function
    const { data: detectResult, error: detectErr } = await supabase.functions.invoke("enroll-face", {
      body: { image_base64: base64 },
    });

    if (detectErr || !detectResult) {
      setErrorMsg("Gagal menghubungi server. Periksa koneksi dan coba lagi.");
      setStep("confirm");
      return;
    }

    if (!detectResult.faces || detectResult.faces.length === 0) {
      setErrorMsg("Wajah tidak terdeteksi dalam foto. Pastikan wajah terlihat jelas, pencahayaan cukup, dan tidak memakai masker.");
      setStep("confirm");
      return;
    }

    if (detectResult.faces.length > 1) {
      setErrorMsg("Terdeteksi lebih dari satu wajah. Pastikan hanya kamu yang ada di foto.");
      setStep("confirm");
      return;
    }

    const faceToken: string = detectResult.faces[0].face_token;

    // 2. Upload foto ke Supabase Storage
    let photoUrl: string | null = null;
    try {
      const fileName = `face_${employee.auth_user_id}.jpg`;
      const blob = await fetch(capturedImage).then((r) => r.blob());
      const { error: uploadErr } = await supabase.storage
        .from("employee-photos")
        .upload(fileName, blob, { contentType: "image/jpeg", upsert: true });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage
          .from("employee-photos")
          .getPublicUrl(fileName);
        photoUrl = urlData.publicUrl;
      }
    } catch { /* lanjut meski upload gagal */ }

    if (!photoUrl) {
      setErrorMsg("Gagal mengupload foto. Periksa koneksi dan coba lagi.");
      setStep("confirm");
      return;
    }

    // 3. Simpan face_token dan face_photo_url ke tabel employees
    const { error: updateErr } = await supabase
      .from("employees")
      .update({ face_token: faceToken, face_photo_url: photoUrl })
      .eq("id", employee.id);

    if (updateErr) {
      setErrorMsg("Gagal menyimpan data wajah: " + updateErr.message);
      setStep("confirm");
      return;
    }

    // 4. Refresh data employee di context
    await refreshEmployee();
    setStep("success");
  };

  // ── Render ──

  if (step === "success") {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-900 pt-1">Daftar Wajah</h1>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isReenroll ? "Wajah Berhasil Diperbarui!" : "Wajah Berhasil Didaftarkan!"}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Kamu sekarang bisa melakukan absensi dengan verifikasi wajah.
            </p>
          </div>
          <button onClick={() => navigate("/employee/dashboard")} className="btn-primary mt-2">
            Ke Beranda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900 pt-1">
        {isReenroll ? "Perbarui Wajah" : "Daftar Wajah"}
      </h1>

      {/* Intro step */}
      {step === "intro" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
              <UserCheck size={28} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {isReenroll ? "Perbarui Data Wajah" : "Daftar Wajah untuk Absensi"}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {isReenroll
                  ? "Ambil foto wajah baru untuk mengganti data yang lama."
                  : "Foto wajahmu akan digunakan untuk verifikasi saat absensi."}
              </p>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-blue-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-blue-800">Tips agar foto berhasil:</p>
            {[
              "Pastikan wajah terlihat jelas dan tidak tertutup",
              "Pencahayaan cukup terang, hindari backlight",
              "Hadap langsung ke kamera, tidak miring",
              "Lepas masker, kacamata hitam, atau topi",
              "Hanya ada satu wajah dalam frame",
            ].map((tip, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-blue-400 text-xs font-bold shrink-0 mt-0.5">•</span>
                <p className="text-xs text-blue-700">{tip}</p>
              </div>
            ))}
          </div>

          <button onClick={() => setStep("camera_ready")} className="btn-primary w-full justify-center">
            <Camera size={15} /> Mulai Ambil Foto
          </button>
        </div>
      )}

      {/* Camera ready step — tombol terpisah agar getUserMedia dari user gesture langsung */}
      {step === "camera_ready" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
            <Camera size={24} className="text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-800">Siap membuka kamera</p>
            <p className="text-sm text-gray-500 mt-1">
              Izinkan akses kamera saat browser meminta.
            </p>
          </div>
          <button onClick={startCamera} className="btn-primary w-full justify-center">
            <Camera size={15} /> Buka Kamera
          </button>
        </div>
      )}

      {/* Camera step */}
      {step === "camera" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center space-y-3">
              <AlertTriangle size={28} className="text-red-400 mx-auto" />
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
                  className="w-full aspect-[4/3] object-cover scale-x-[-1]"
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
          <div className="p-4 space-y-4">
            <img
              src={capturedImage}
              alt="Foto wajah"
              className="w-full aspect-[4/3] object-cover rounded-xl"
            />

            {errorMsg && (
              <div className="p-3 bg-red-50 rounded-lg flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{errorMsg}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button onClick={retakePhoto} className="btn-secondary justify-center">
                <RefreshCw size={14} /> Foto Ulang
              </button>
              <button onClick={submitEnrollment} className="btn-primary justify-center">
                <CheckCircle size={14} /> Daftar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Processing step */}
      {step === "processing" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col items-center gap-4">
          <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
            <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-800">Mendaftarkan wajah...</p>
            <p className="text-sm text-gray-500 mt-1">Mohon tunggu sebentar</p>
          </div>
        </div>
      )}
    </div>
  );
}
