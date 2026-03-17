import { useAuth } from '../../hooks/useAuth'
import { Users, Clock, CheckCircle, XCircle, MapPin, TrendingUp } from 'lucide-react'

const stats = [
  { label: 'On Time', value: '2', color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle },
  { label: 'In Tolerance', value: '0', color: 'text-yellow-600', bg: 'bg-yellow-50', icon: Clock },
  { label: 'Late', value: '8', color: 'text-red-600', bg: 'bg-red-50', icon: XCircle },
  { label: 'In Location', value: '8', color: 'text-blue-600', bg: 'bg-blue-50', icon: MapPin },
  { label: 'Out of Location', value: '0', color: 'text-orange-600', bg: 'bg-orange-50', icon: TrendingUp },
  { label: 'Total Active', value: '13', color: 'text-purple-600', bg: 'bg-purple-50', icon: Users },
]

export default function Dashboard() {
  const { employee } = useAuth()

  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          Selamat datang, {employee?.full_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{today}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="card p-4 flex flex-col items-center text-center">
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-2`}>
                <Icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Aktivitas Hari Ini</h3>
          <div className="flex items-center justify-center h-32 text-gray-400">
            <div className="text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Belum ada data absensi hari ini</p>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Pengajuan Pending</h3>
          <div className="flex items-center justify-center h-32 text-gray-400">
            <div className="text-center">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Tidak ada pengajuan pending</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
