import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Search, Download } from 'lucide-react'
import { Spinner, EmptyState, Pagination, StatusBadge, LocationBadge, formatTime } from '../../components/ui'
import { exportCsv, csvTime, csvMins } from '../../lib/exportCsv'
import type { Group } from '../../types'

interface ActivityRow {
  id: string
  attendance_date: string
  employee: { full_name: string; employee_code: string; group: { name: string } | null }
  time_in: string | null
  time_out: string | null
  status_in: string | null
  status_out: string | null
  location_in_status: string | null
  location_out_status: string | null
  reason_in: string | null
  reason_out: string | null
  work_minutes: number
  late_minutes: number
}

export default function ActivityReportPage() {
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

  const [startDate, setStartDate]     = useState(firstOfMonth)
  const [endDate, setEndDate]         = useState(today)
  const [groupFilter, setGroupFilter] = useState('all')
  const [search, setSearch]           = useState('')
  const [groups, setGroups]           = useState<Group[]>([])
  const [rows, setRows]               = useState<ActivityRow[]>([])
  const [loading, setLoading]         = useState(false)
  const [page, setPage]               = useState(1)
  const [pageSize, setPageSize]       = useState(10)
  const [total, setTotal]             = useState(0)

  useEffect(() => {
    supabase.from('groups').select('id,name').order('name')
      .then(({ data }) => setGroups((data || []) as Group[]))
  }, [])

  const fetchActivities = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('attendances')
        .select(`
          id, attendance_date, time_in, time_out,
          status_in, status_out, location_in_status, location_out_status,
          reason_in, reason_out, work_minutes, late_minutes,
          employee:employees(full_name, employee_code, group:groups(name))
        `, { count: 'exact' })
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate)
        .order('attendance_date', { ascending: false })
        .order('time_in', { ascending: false })

      if (groupFilter !== 'all') q = q.eq('employees.group_id', groupFilter)
      if (search) q = q.ilike('employees.full_name', `%${search}%`)

      const { data, count } = await q.range((page - 1) * pageSize, page * pageSize - 1)

      setRows((data || []) as unknown as ActivityRow[])
      setTotal(count || 0)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, groupFilter, search, page, pageSize])

  useEffect(() => { fetchActivities() }, [fetchActivities])

  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      let q = supabase
        .from('attendances')
        .select('attendance_date,time_in,time_out,status_in,status_out,location_in_status,location_out_status,work_minutes,late_minutes,employee:employees(full_name,employee_code,group:groups(name))')
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate)
        .order('attendance_date', { ascending: false })

      if (groupFilter !== 'all') q = q.eq('employees.group_id', groupFilter)
      if (search) q = q.ilike('employees.full_name', `%${search}%`)

      const { data } = await q
      exportCsv(`activity-report_${startDate}_${endDate}`, [
        'Tanggal', 'Nama', 'Kode', 'Grup',
        'Jam Masuk', 'Status Masuk', 'Lokasi Masuk',
        'Jam Keluar', 'Status Keluar', 'Jam Kerja', 'Terlambat',
      ], (data || []).map((r: any) => [
        r.attendance_date,
        r.employee?.full_name ?? '', r.employee?.employee_code ?? '', r.employee?.group?.name ?? '',
        csvTime(r.time_in), r.status_in ?? '', r.location_in_status ?? '',
        csvTime(r.time_out), r.status_out ?? '',
        csvMins(r.work_minutes), csvMins(r.late_minutes),
      ]))
    } finally {
      setDownloading(false)
    }
  }

  const fmtMins = (m: number) => {
    if (!m) return '-'
    const h = Math.floor(m / 60), min = m % 60
    return `${h}h ${min}m`
  }

  return (
    <div>
      <h1 className="page-title mb-6">Activity Report</h1>

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="form-label">Start Date</label>
            <input type="date" className="form-input w-40" value={startDate}
              onChange={e => { setStartDate(e.target.value); setPage(1) }} />
          </div>
          <div>
            <label className="form-label">End Date</label>
            <input type="date" className="form-input w-40" value={endDate}
              onChange={e => { setEndDate(e.target.value); setPage(1) }} />
          </div>
          <div>
            <label className="form-label">Group</label>
            <select className="form-input w-40" value={groupFilter}
              onChange={e => { setGroupFilter(e.target.value); setPage(1) }}>
              <option value="all">All Group</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="form-input pl-8 w-48" placeholder="Cari karyawan..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <button onClick={fetchActivities} className="btn-primary"><Search size={14} /> Search</button>
          <button onClick={handleDownload} disabled={downloading} className="btn-secondary ml-auto">
            {downloading ? <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Download size={14} />}
            {downloading ? 'Mengunduh...' : 'Download'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Group</th>
                <th>Time In</th>
                <th>Status In</th>
                <th>Location In</th>
                <th>Time Out</th>
                <th>Status Out</th>
                <th>Work Time</th>
                <th>Late</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-16"><Spinner className="mx-auto" /></td></tr>
              ) : rows.length === 0 ? (
                <EmptyState message="Tidak ada data aktivitas" />
              ) : (
                rows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50/60">
                    <td className="text-gray-600 text-xs font-mono whitespace-nowrap">{row.attendance_date}</td>
                    <td className="font-medium text-gray-900">{row.employee?.full_name}</td>
                    <td><span className="badge badge-gray text-xs">{row.employee?.group?.name || '-'}</span></td>
                    <td className="font-mono text-xs">{formatTime(row.time_in)}</td>
                    <td><StatusBadge status={row.status_in} /></td>
                    <td><LocationBadge status={row.location_in_status} /></td>
                    <td className="font-mono text-xs">{formatTime(row.time_out)}</td>
                    <td><StatusBadge status={row.status_out} /></td>
                    <td className="font-mono text-xs text-green-600">{fmtMins(row.work_minutes)}</td>
                    <td className="font-mono text-xs text-red-500">{fmtMins(row.late_minutes)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={setPageSize} />
      </div>
    </div>
  )
}
