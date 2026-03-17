import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { ShieldOff } from 'lucide-react'

export default function Unauthorized() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldOff className="w-7 h-7 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Akses Ditolak</h2>
        <p className="text-sm text-gray-500 mb-6">
          Akun Google kamu belum terdaftar di sistem. Hubungi HR atau Admin untuk mendaftarkan akunmu.
        </p>
        <button onClick={handleSignOut} className="btn-primary w-full justify-center">
          Keluar & Coba Akun Lain
        </button>
      </div>
    </div>
  )
}
