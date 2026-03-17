import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { Session } from "@supabase/supabase-js";

export default function AuthCallback() {
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    // Cek error dari URL (misal hook Supabase gagal)
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get("error");
    const urlErrorDesc = params.get("error_description");
    if (urlError) {
      console.error("Auth callback error:", urlError, urlErrorDesc);
      navigate(`/auth/login?error=${encodeURIComponent(urlErrorDesc ?? urlError)}`, { replace: true });
      return;
    }

    const processSession = async (session: Session) => {
      if (handled.current) return;
      handled.current = true;

      // Cek apakah user sudah punya employee record
      const { data: employee } = await supabase
        .from("employees")
        .select("id, access_type")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (employee) {
        navigate("/summary-report", { replace: true });
        return;
      }

      // Belum terdaftar → cek apakah ada HR/admin sama sekali
      const { count } = await supabase
        .from("employees")
        .select("*", { count: "exact", head: true });

      if (count === 0 || count === null) {
        navigate("/setup", { replace: true });
      } else {
        navigate("/auth/unauthorized", { replace: true });
      }
    };

    // Gunakan onAuthStateChange agar token dari URL hash sudah diproses Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          await processSession(session);
        } else if (event === "SIGNED_OUT") {
          // Hanya redirect ke login jika memang sign out, bukan INITIAL_SESSION null
          navigate("/auth/login", { replace: true });
        }
        // INITIAL_SESSION dengan null diabaikan — token mungkin belum selesai diproses
      }
    );

    // Fallback: jika dalam 8 detik tidak ada session, redirect ke login
    const timeout = setTimeout(() => {
      if (!handled.current) navigate("/auth/login", { replace: true });
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Memverifikasi akun...</p>
      </div>
    </div>
  );
}
