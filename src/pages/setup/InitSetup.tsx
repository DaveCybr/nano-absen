import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import {
  CheckCircle,
  Building2,
  User,
  Shield,
  ChevronRight,
} from "lucide-react";

type Step = "welcome" | "company" | "account" | "done";

interface CompanyForm {
  name: string;
  address: string;
  phone: string;
  email: string;
  timezone: string;
  cutoff_date: string;
}

interface AccountForm {
  employee_code: string;
  full_name: string;
  phone: string;
}

export default function InitSetup() {
  const { user, refreshEmployee } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("welcome");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [company, setCompany] = useState<CompanyForm>({
    name: "PT Nano Indonesia Sakti",
    address: "",
    phone: "",
    email: "",
    timezone: "Asia/Jakarta",
    cutoff_date: "1",
  });

  const [account, setAccount] = useState<AccountForm>({
    employee_code: "01",
    full_name: user?.user_metadata?.full_name || "",
    phone: "",
  });

  const steps = [
    { id: "welcome", label: "Mulai", icon: Shield },
    { id: "company", label: "Perusahaan", icon: Building2 },
    { id: "account", label: "Akun HR", icon: User },
    { id: "done", label: "Selesai", icon: CheckCircle },
  ];

  const currentStepIdx = steps.findIndex((s) => s.id === step);

  const handleSaveCompany = async () => {
    if (!company.name.trim()) {
      setError("Nama perusahaan wajib diisi");
      return;
    }
    setError("");
    setLoading(true);

    const { error: err } = await supabase.from("companies").upsert(
      {
        company_slug: "pt-nanoindonesiasakti",
        name: company.name,
        address: company.address || null,
        phone: company.phone || null,
        email: company.email || null,
        timezone: company.timezone,
        cutoff_date: parseInt(company.cutoff_date),
      },
      {
        onConflict: "company_slug",
        ignoreDuplicates: false,
      },
    );

    if (err) {
      setError(`Gagal menyimpan: ${err.message}`);
      setLoading(false);
      return;
    }

    setLoading(false);
    setStep("account");
  };

  const handleSaveAccount = async () => {
    if (!account.full_name.trim()) {
      setError("Nama lengkap wajib diisi");
      return;
    }
    if (!account.employee_code.trim()) {
      setError("ID karyawan wajib diisi");
      return;
    }
    if (!user) {
      setError("Sesi tidak valid, silakan login ulang");
      return;
    }
    setError("");

    setLoading(true);

    // Insert HR employee record
    const { error: err } = await supabase.from("employees").insert({
      auth_user_id: user.id,
      employee_code: account.employee_code,
      full_name: account.full_name,
      email: user.email,
      phone: account.phone || null,
      access_type: "hr",
      working_status: "active",
      is_active: true,
      join_date: new Date().toISOString().split("T")[0],
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    await refreshEmployee();
    setLoading(false);
    setStep("done");
  };

  const handleFinish = () => navigate("/dashboard", { replace: true });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 text-white fill-current"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-gray-900">
              TEFA Presensi
            </span>
          </div>
          <p className="text-sm text-gray-500">Setup Awal Sistem</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  idx < currentStepIdx
                    ? "bg-green-100 text-green-700"
                    : idx === currentStepIdx
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                <s.icon className="w-3.5 h-3.5" />
                <span>{s.label}</span>
              </div>
              {idx < steps.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          {/* Step: Welcome */}
          {step === "welcome" && (
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Shield className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">
                Selamat Datang!
              </h2>
              <p className="text-sm text-gray-500 mb-2">
                Ini adalah pertama kalinya sistem dijalankan.
              </p>
              <p className="text-sm text-gray-500 mb-8">
                Kamu akan menjadi akun{" "}
                <span className="font-medium text-blue-600">
                  HR Administrator
                </span>{" "}
                pertama. Ikuti langkah berikut untuk menyelesaikan setup awal.
              </p>
              <div className="space-y-3 text-left mb-8">
                {[
                  { icon: Building2, text: "Konfigurasi data perusahaan" },
                  { icon: User, text: "Buat akun HR Administrator" },
                ].map(({ icon: Icon, text }, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                  >
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-sm text-gray-700">{text}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStep("company")}
                className="btn-primary w-full justify-center py-3"
              >
                Mulai Setup
              </button>
            </div>
          )}

          {/* Step: Company */}
          {step === "company" && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Data Perusahaan
                  </h2>
                  <p className="text-xs text-gray-500">
                    Bisa diubah kapanpun di Settings → Company
                  </p>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="form-label">Nama Perusahaan *</label>
                  <input
                    className="form-input"
                    value={company.name}
                    onChange={(e) =>
                      setCompany((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="PT Nano Indonesia Sakti"
                  />
                </div>
                <div>
                  <label className="form-label">Alamat Kantor</label>
                  <input
                    className="form-input"
                    value={company.address}
                    onChange={(e) =>
                      setCompany((p) => ({ ...p, address: e.target.value }))
                    }
                    placeholder="Jl. Imam Bonjol, Royal City Icon..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">No. Telepon</label>
                    <input
                      className="form-input"
                      value={company.phone}
                      onChange={(e) =>
                        setCompany((p) => ({ ...p, phone: e.target.value }))
                      }
                      placeholder="+62..."
                    />
                  </div>
                  <div>
                    <label className="form-label">Email Perusahaan</label>
                    <input
                      className="form-input"
                      type="email"
                      value={company.email}
                      onChange={(e) =>
                        setCompany((p) => ({ ...p, email: e.target.value }))
                      }
                      placeholder="hr@nano.co.id"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Timezone</label>
                    <select
                      className="form-input"
                      value={company.timezone}
                      onChange={(e) =>
                        setCompany((p) => ({ ...p, timezone: e.target.value }))
                      }
                    >
                      <option value="Asia/Jakarta">WIB (Asia/Jakarta)</option>
                      <option value="Asia/Makassar">
                        WITA (Asia/Makassar)
                      </option>
                      <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Cutoff Date</label>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      max="28"
                      value={company.cutoff_date}
                      onChange={(e) =>
                        setCompany((p) => ({
                          ...p,
                          cutoff_date: e.target.value,
                        }))
                      }
                      placeholder="1"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Tanggal awal periode laporan
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep("welcome")}
                  className="btn-secondary flex-1 justify-center"
                >
                  Kembali
                </button>
                <button
                  onClick={handleSaveCompany}
                  disabled={loading}
                  className="btn-primary flex-1 justify-center"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                      Menyimpan...
                    </>
                  ) : (
                    "Lanjutkan"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step: Account */}
          {step === "account" && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Akun HR Administrator
                  </h2>
                  <p className="text-xs text-gray-500">
                    Data akun kamu sebagai HR pertama
                  </p>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Google account info */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-5 border border-gray-200">
                {user?.user_metadata?.avatar_url && (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt=""
                    className="w-9 h-9 rounded-full"
                  />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {user?.user_metadata?.full_name}
                  </p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <span className="ml-auto badge badge-blue">Google OAuth</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="form-label">Nama Lengkap *</label>
                  <input
                    className="form-input"
                    value={account.full_name}
                    onChange={(e) =>
                      setAccount((p) => ({ ...p, full_name: e.target.value }))
                    }
                    placeholder="Nama lengkap sesuai KTP"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">ID Karyawan *</label>
                    <input
                      className="form-input"
                      value={account.employee_code}
                      onChange={(e) =>
                        setAccount((p) => ({
                          ...p,
                          employee_code: e.target.value,
                        }))
                      }
                      placeholder="01"
                    />
                  </div>
                  <div>
                    <label className="form-label">No. Telepon</label>
                    <input
                      className="form-input"
                      value={account.phone}
                      onChange={(e) =>
                        setAccount((p) => ({ ...p, phone: e.target.value }))
                      }
                      placeholder="08xx"
                    />
                  </div>
                </div>
                <div>
                  <label className="form-label">Role</label>
                  <input
                    className="form-input"
                    value="HR Administrator"
                    disabled
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Role dapat diubah di Settings → Employee
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep("company")}
                  className="btn-secondary flex-1 justify-center"
                >
                  Kembali
                </button>
                <button
                  onClick={handleSaveAccount}
                  disabled={loading}
                  className="btn-primary flex-1 justify-center"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                      Menyimpan...
                    </>
                  ) : (
                    "Selesaikan Setup"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step: Done */}
          {step === "done" && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-9 h-9 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">
                Setup Selesai!
              </h2>
              <p className="text-sm text-gray-500 mb-8">
                Sistem TEFA Presensi siap digunakan. Kamu sudah terdaftar
                sebagai{" "}
                <span className="font-medium text-blue-600">
                  HR Administrator
                </span>
                .
              </p>
              <div className="space-y-2 text-left mb-8">
                {[
                  "Tambahkan karyawan di Settings → Employee",
                  "Buat grup divisi di Settings → Groups",
                  "Atur zona kantor di Settings → Zones",
                  "Buat kode shift di Manage → Shifting",
                ].map((tip, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-600"
                  >
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleFinish}
                className="btn-primary w-full justify-center py-3"
              >
                Buka Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
