import { useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Popup, CircleMarker, Circle, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../../lib/supabase'
import { Clock, Search, RefreshCw, LogIn, LogOut, Filter } from 'lucide-react'
import { StatusBadge, LocationBadge, formatTime } from '../../components/ui'
import clsx from 'clsx'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface ActivityItem {
  id: string
  employee_id: string
  full_name: string
  face_photo_url: string | null
  type: 'check_in' | 'check_out'
  time: string | null
  status: string | null
  location_status: string | null
  lat: number | null
  lng: number | null
  attendance_date: string
}

interface ZoneItem {
  id: string
  office_name: string
  latitude: number
  longitude: number
  radius_meters: number
}

const pinColor = (status: string | null) => {
  if (status === 'on_time') return '#22c55e'
  if (status === 'in_tolerance') return '#eab308'
  if (status === 'late') return '#ef4444'
  return '#6b7280'
}

// Fly to a position when `target` changes
function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target, 17, { duration: 1 })
  }, [target, map])
  return null
}

// Auto-fit bounds to all markers
function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap()
  const fitted = useRef(false)
  useEffect(() => {
    if (!fitted.current && coords.length > 0) {
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 16 })
      fitted.current = true
    }
  }, [coords, map])
  return null
}

export default function LocationMapPage() {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate]             = useState(today)
  const [typeFilter, setTypeFilter] = useState<'all' | 'check_in' | 'check_out'>('all')
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [zones, setZones]           = useState<ZoneItem[]>([])
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState<ActivityItem | null>(null)
  const [flyTarget, setFlyTarget]   = useState<[number, number] | null>(null)
  const [loading, setLoading]       = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [stats, setStats] = useState({ total: 0, on_time: 0, in_tolerance: 0, late: 0, out_of_area: 0 })

  // Fetch zones for overlay
  useEffect(() => {
    supabase.from('zones').select('id,office_name,latitude,longitude,radius_meters')
      .then(({ data }) => setZones((data || []) as ZoneItem[]))
  }, [])

  const fetchActivities = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('attendances')
      .select(`
        id, employee_id, attendance_date,
        time_in, time_out,
        status_in, status_out,
        location_in_status, location_out_status,
        lat_in, lng_in, lat_out, lng_out,
        employee:employees(full_name, face_photo_url)
      `)
      .eq('attendance_date', date)
      .order('time_in', { ascending: false })
      .limit(200)

    const items: ActivityItem[] = []
    for (const r of (data || []) as any[]) {
      if ((typeFilter === 'all' || typeFilter === 'check_out') && r.time_out && r.lat_out && r.lng_out) {
        items.push({
          id: `${r.id}-out`, employee_id: r.employee_id,
          full_name: r.employee?.full_name || '-',
          face_photo_url: r.employee?.face_photo_url || null,
          type: 'check_out',
          time: r.time_out, status: r.status_out,
          location_status: r.location_out_status,
          lat: r.lat_out, lng: r.lng_out,
          attendance_date: r.attendance_date,
        })
      }
      if ((typeFilter === 'all' || typeFilter === 'check_in') && r.lat_in && r.lng_in) {
        items.push({
          id: `${r.id}-in`, employee_id: r.employee_id,
          full_name: r.employee?.full_name || '-',
          face_photo_url: r.employee?.face_photo_url || null,
          type: 'check_in',
          time: r.time_in, status: r.status_in,
          location_status: r.location_in_status,
          lat: r.lat_in, lng: r.lng_in,
          attendance_date: r.attendance_date,
        })
      }
    }

    setActivities(items)
    setLastUpdated(new Date())
    setStats({
      total:        (data || []).length,
      on_time:      (data || []).filter((r: any) => r.status_in === 'on_time').length,
      in_tolerance: (data || []).filter((r: any) => r.status_in === 'in_tolerance').length,
      late:         (data || []).filter((r: any) => r.status_in === 'late').length,
      out_of_area:  (data || []).filter((r: any) => r.location_in_status === 'out_of_area').length,
    })
    setLoading(false)
  }, [date, typeFilter])

  useEffect(() => {
    fetchActivities()
    const interval = setInterval(fetchActivities, 60000)
    return () => clearInterval(interval)
  }, [fetchActivities])

  const handleSelectItem = (item: ActivityItem) => {
    setSelected(item)
    if (item.lat && item.lng) setFlyTarget([item.lat, item.lng])
  }

  const filtered = activities.filter(a =>
    !search || a.full_name.toLowerCase().includes(search.toLowerCase())
  )

  const withCoords = activities.filter(a => a.lat && a.lng)
  const allCoords: [number, number][] = withCoords.map(a => [a.lat!, a.lng!])
  const mapCenter: [number, number] = zones.length > 0
    ? [zones[0].latitude, zones[0].longitude]
    : withCoords.length > 0
    ? [withCoords[0].lat!, withCoords[0].lng!]
    : [-8.1726, 113.6880]

  const fmtUpdated = lastUpdated
    ? lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '-'

  return (
    <div className="flex gap-0 h-[calc(100vh-120px)] -m-6">
      {/* ── Map ── */}
      <div className="flex-1 relative">
        <MapContainer center={mapCenter} zoom={15} className="w-full h-full" style={{ zIndex: 0 }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FlyTo target={flyTarget} />
          <FitBounds coords={allCoords} />

          {/* Zone circles overlay */}
          {zones.map(z => (
            <Circle
              key={z.id}
              center={[z.latitude, z.longitude]}
              radius={z.radius_meters}
              pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.08, weight: 2, dashArray: '6 4' }}
            >
              <Popup>
                <p className="font-semibold text-sm">{z.office_name}</p>
                <p className="text-xs text-gray-500">Radius: {z.radius_meters}m</p>
              </Popup>
            </Circle>
          ))}

          {/* Zone center markers */}
          {zones.map(z => (
            <Marker key={`z-${z.id}`} position={[z.latitude, z.longitude]}>
              <Popup>
                <p className="font-semibold">{z.office_name}</p>
                <p className="text-xs font-mono text-gray-500">{z.latitude.toFixed(5)}, {z.longitude.toFixed(5)}</p>
              </Popup>
            </Marker>
          ))}

          {/* Attendance pins */}
          {withCoords.map(a => (
            <CircleMarker
              key={a.id}
              center={[a.lat!, a.lng!]}
              radius={a.type === 'check_in' ? 9 : 7}
              pathOptions={{
                fillColor: a.type === 'check_in' ? pinColor(a.status) : '#f97316',
                fillOpacity: 0.92,
                color: selected?.id === a.id ? '#1d4ed8' : '#fff',
                weight: selected?.id === a.id ? 3 : 2,
              }}
              eventHandlers={{ click: () => handleSelectItem(a) }}
            >
              <Popup>
                <div className="min-w-[160px] text-xs space-y-1">
                  <p className="font-bold text-sm text-gray-900">{a.full_name}</p>
                  <div className="flex items-center gap-1">
                    {a.type === 'check_in'
                      ? <span className="text-green-600 font-medium">↑ Check In</span>
                      : <span className="text-orange-500 font-medium">↓ Check Out</span>}
                  </div>
                  <p className="font-mono text-gray-700">{formatTime(a.time)}</p>
                  <p className="text-gray-500">{a.status?.replace('_', ' ')}</p>
                  <p className="font-mono text-[10px] text-gray-400">{a.lat?.toFixed(5)}, {a.lng?.toFixed(5)}</p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* Stats overlay — top left */}
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur rounded-xl shadow-lg p-3 min-w-[170px]" style={{ zIndex: 1000 }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-600">Kehadiran {date === today ? 'Hari Ini' : date}</p>
            <span className="text-[10px] text-gray-400">{stats.total} orang</span>
          </div>
          {[
            { color: 'bg-green-500',  label: 'On Time',    val: stats.on_time,      text: 'text-green-600' },
            { color: 'bg-yellow-400', label: 'Toleransi',  val: stats.in_tolerance, text: 'text-yellow-600' },
            { color: 'bg-red-500',    label: 'Terlambat',  val: stats.late,         text: 'text-red-600' },
            { color: 'bg-gray-400',   label: 'Out of Area',val: stats.out_of_area,  text: 'text-gray-600' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2 text-xs py-0.5">
              <div className={`w-2 h-2 rounded-full shrink-0 ${s.color}`} />
              <span className="text-gray-600 flex-1">{s.label}</span>
              <span className={`font-bold ${s.text}`}>{s.val}</span>
            </div>
          ))}
        </div>

        {/* Legend — bottom left */}
        <div className="absolute bottom-6 left-3 bg-white/95 backdrop-blur rounded-xl shadow px-3 py-2 text-xs space-y-1" style={{ zIndex: 1000 }}>
          <p className="font-semibold text-gray-500 mb-1">Legenda</p>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500" /> On Time</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-400" /> In Tolerance</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /> Late</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500" /> Check Out</div>
          <div className="flex items-center gap-2 mt-1"><div className="w-3 h-3 rounded border-2 border-blue-500 border-dashed" /> Zona Kantor</div>
        </div>
      </div>

      {/* ── Sidebar ── */}
      <div className="w-80 shrink-0 bg-white border-l border-gray-100 flex flex-col" style={{ zIndex: 1 }}>

        {/* Header toolbar */}
        <div className="p-3 border-b border-gray-100 space-y-2">
          {/* Date + Refresh */}
          <div className="flex items-center gap-2">
            <input type="date" className="form-input text-xs py-1.5 flex-1" value={date}
              onChange={e => { setDate(e.target.value); setSelected(null) }} />
            <button onClick={fetchActivities} disabled={loading}
              className="btn-icon text-blue-500 shrink-0" title="Refresh">
              <RefreshCw size={14} className={clsx(loading && 'animate-spin')} />
            </button>
          </div>

          {/* Type filter */}
          <div className="flex gap-1">
            {([
              { v: 'all',       label: 'Semua' },
              { v: 'check_in',  label: '↑ In',  icon: <LogIn  size={11} /> },
              { v: 'check_out', label: '↓ Out', icon: <LogOut size={11} /> },
            ] as const).map(f => (
              <button key={f.v} onClick={() => setTypeFilter(f.v)}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  typeFilter === f.v
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'text-gray-500 border-gray-200 hover:bg-gray-50'
                )}>
                {'icon' in f && f.icon}{f.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="form-input pl-7 py-1.5 text-sm w-full" placeholder="Cari karyawan..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Last updated */}
          <p className="text-[10px] text-gray-400 flex items-center gap-1">
            <Clock size={9} /> Diperbarui: {fmtUpdated}
          </p>
        </div>

        {/* Activity list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-gray-400">
              <Filter size={24} className="mb-2 opacity-40" />
              <p className="text-sm">Tidak ada data</p>
            </div>
          ) : (
            filtered.map(item => (
              <button
                key={item.id}
                onClick={() => handleSelectItem(item)}
                className={clsx(
                  'w-full text-left px-3 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors',
                  selected?.id === item.id && 'bg-blue-50 border-blue-100'
                )}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full shrink-0 mt-0.5 overflow-hidden flex items-center justify-center text-white text-[11px] font-bold border-2"
                    style={{ borderColor: item.type === 'check_in' ? pinColor(item.status) : '#f97316', background: item.face_photo_url ? 'transparent' : (item.type === 'check_in' ? pinColor(item.status) : '#f97316') }}
                  >
                    {item.face_photo_url
                      ? <img src={item.face_photo_url} alt="" className="w-full h-full object-cover" />
                      : item.full_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.full_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className={clsx('text-xs font-medium', item.type === 'check_in' ? 'text-green-600' : 'text-orange-500')}>
                        {item.type === 'check_in' ? '↑ Check In' : '↓ Check Out'}
                      </span>
                      <span className="text-gray-200">|</span>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <LocationBadge status={item.location_status} />
                      <span className="text-[10px] text-gray-400 font-mono">{formatTime(item.time)}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Selected detail panel */}
        {selected && (
          <div className="border-t border-gray-200 p-3 bg-gray-50 shrink-0">
            <div className="flex items-center gap-2 mb-2">
              {selected.face_photo_url
                ? <img src={selected.face_photo_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 border border-gray-200" />
                : <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white text-sm font-bold" style={{ background: selected.type === 'check_in' ? pinColor(selected.status) : '#f97316' }}>{selected.full_name.charAt(0)}</div>
              }
              <p className="text-sm font-bold text-gray-900 truncate flex-1">{selected.full_name}</p>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 shrink-0">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
              <span className="text-gray-400">Tipe</span>
              <span className={clsx('font-medium', selected.type === 'check_in' ? 'text-green-600' : 'text-orange-500')}>
                {selected.type === 'check_in' ? '↑ Check In' : '↓ Check Out'}
              </span>
              <span className="text-gray-400">Waktu</span>
              <span className="font-mono">{formatTime(selected.time)}</span>
              <span className="text-gray-400">Status</span>
              <span><StatusBadge status={selected.status} /></span>
              <span className="text-gray-400">Lokasi</span>
              <span><LocationBadge status={selected.location_status} /></span>
              {selected.lat && selected.lng && (
                <>
                  <span className="text-gray-400">Koordinat</span>
                  <span className="font-mono text-[10px]">{selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
