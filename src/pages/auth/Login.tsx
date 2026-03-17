import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function Login() {
  const { session, signInWithGoogle, loading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [searchParams] = useSearchParams();
  const authError = searchParams.get("error");

  if (!loading && session) return <Navigate to="/dashboard" replace />;

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="w-6 h-6 text-white fill-current"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">
              TEFA Presensi
            </span>
          </div>
          <p className="text-sm text-gray-500">PT Nano Indonesia Sakti</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">
            Masuk ke Dashboard
          </h1>
          <p className="text-sm text-gray-500 mb-8">
            Gunakan akun Google perusahaan yang sudah terdaftar
          </p>

          <button
            onClick={handleGoogleLogin}
            disabled={isSigningIn || loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isSigningIn ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                <span>Menghubungkan...</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="w-5 h-5">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Masuk dengan Google</span>
              </>
            )}
          </button>

          {authError && (
            <div className="mt-4 p-4 bg-red-50 rounded-xl">
              <p className="text-xs text-red-700 text-center">{authError}</p>
            </div>
          )}

          <div className="mt-4 p-4 bg-blue-50 rounded-xl">
            <p className="text-xs text-blue-700 text-center">
              Hanya akun yang telah didaftarkan oleh HR/Admin yang dapat
              mengakses sistem ini
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © 2026 PT Nano Indonesia Sakti · TEFA Presensi v1.0
        </p>
      </div>
    </div>
  );
}
