import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { LogIn, LogOut, Search } from 'lucide-react'
import { Spinner, EmptyState, Pagination, StatusBadge, LocationBadge, formatTime } from '../../components/ui'

interface IssueRow {
  id: string
  type: 'check_in' | 'check_out'
  employee_id: string
  employee: { full_name: string; face_photo_url: string | null }
  status_in: string | null
  status_out: string | null
  location_in_status: string | null
  location_out_status: string | null
  time_in: string | null
  time_out: string | null
  attendance_date: string
}

export default function IssueAttendancePage() {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate]             = useState(today)
  const [scheduleFilter, setScheduleFilter] = useState('all')
  const [search, setSearch]         = useState('')
  const [allEvents, setAllEvents]   = useState<IssueRow[]>([])
  const [loading, setLoading]       = useState(false)
  const [page, setPage]             = useState(1)
  const [pageSize, setPageSize]     = useState(10)

  const fetchIssues = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('attendances')
        .select(`
          id, employee_id, attendance_date,
          time_in, time_out,
          status_in, status_out,
          location_in_status, location_out_status,
          employee:employees(full_name, face_photo_url)
        `)
        .eq('attendance_date', date)
        .order('time_in', { ascending: false })

      // Flatten each attendance record into separate check_in / check_out events
      const events: IssueRow[] = []
      for (const r of (data || []) as any[]) {
        if (r.time_out) events.push({ ...r, type: 'check_out' })
        events.push({ ...r, type: 'check_in' })
      }
      setAllEvents(events)
      setPage(1)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { fetchIssues() }, [fetchIssues])

  // Filter by search client-side, then paginate the events
  const filtered = search
    ? allEvents.filter(r => r.employee?.full_name?.toLowerCase().includes(search.toLowerCase()))
    : allEvents

  const total = filtered.length
  const rows  = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div>
      <h1 className="page-title mb-6">Issue Attendance</h1>

      <div className="card">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 p-4 border-b border-gray-100">
          <div>
            <label className="form-label">Date</label>
            <input type="date" className="form-input w-40" value={date}
              onChange={e => { setDate(e.target.value); setPage(1) }} />
          </div>
          <div>
            <label className="form-label">Schedule Type</label>
            <select className="form-input w-40" value={scheduleFilter}
              onChange={e => setScheduleFilter(e.target.value)}>
              <option value="all">All Schedule</option>
              <option value="regular">Regular</option>
              <option value="shifting">Shifting</option>
            </select>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="form-input pl-8 w-48" placeholder="Search..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="w-12">Type</th>
                <th>User Name</th>
                <th>Reason (Time)</th>
                <th>Note (Location)</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-16"><Spinner className="mx-auto" /></td></tr>
              ) : rows.length === 0 ? (
                <EmptyState message="Tidak ada aktivitas absensi" />
              ) : (
                rows.map((row) => (
                  <tr key={`${row.id}-${row.type}`} className="hover:bg-gray-50/60">
                    <td>
                      {row.type === 'check_in' ? (
                        <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center" title="Check In">
                          <LogIn size={14} className="text-green-600" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center" title="Check Out">
                          <LogOut size={14} className="text-orange-500" />
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                          {row.employee?.full_name?.charAt(0) || '?'}
                        </div>
                        <span className="font-medium text-gray-900">{row.employee?.full_name}</span>
                      </div>
                    </td>
                    <td>
                      {row.type === 'check_in'
                        ? <StatusBadge status={row.status_in} />
                        : <StatusBadge status={row.status_out} />}
                    </td>
                    <td>
                      {row.type === 'check_in'
                        ? <LocationBadge status={row.location_in_status} />
                        : <LocationBadge status={row.location_out_status} />}
                    </td>
                    <td className="font-mono text-sm text-gray-700">
                      {row.type === 'check_in'
                        ? formatTime(row.time_in)
                        : formatTime(row.time_out)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} pageSize={pageSize} total={total}
          onPage={setPage} onPageSize={setPageSize} />
      </div>
    </div>
  )
}
