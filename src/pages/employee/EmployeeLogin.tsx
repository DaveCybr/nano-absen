import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Eye, EyeOff } from "lucide-react";

export default function EmployeeLogin() {
  const { session, employee, loading, signInWithPassword } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session && employee) {
      if (employee.access_type === "staff") {
        navigate("/employee/dashboard", { replace: true });
      } else {
        navigate("/summary-report", { replace: true });
      }
    }
  }, [loading, session, employee, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Email dan password wajib diisi."); return; }
    setError("");
    setSubmitting(true);
    try {
      await signInWithPassword(email, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Invalid login credentials")) setError("Email atau password salah.");
      else if (msg.includes("Email not confirmed")) setError("Email belum dikonfirmasi.");
      else setError("Login gagal. Periksa koneksi dan coba lagi.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-white fill-current">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">nano.HR</span>
          </div>
          <p className="text-sm text-gray-500">Portal Karyawan</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Masuk</h1>
          <p className="text-sm text-gray-500 mb-6">
            Gunakan email & password yang diberikan HR
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input w-full"
                placeholder="email@perusahaan.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="form-label">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  className="form-input w-full pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 rounded-lg text-xs text-red-700">{error}</div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full justify-center"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Masuk...
                </>
              ) : (
                "Masuk"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          Login sebagai Admin?{" "}
          <Link to="/auth/login" className="text-blue-500 hover:underline">
            Klik di sini
          </Link>
        </p>
        <p className="text-center text-xs text-gray-400 mt-2">
          © 2026 PT Nano Indonesia Sakti
        </p>
      </div>
    </div>
  );
}
