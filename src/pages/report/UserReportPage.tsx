import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Download, Search } from 'lucide-react'
import { Spinner, EmptyState, Pagination, formatMinutes } from '../../components/ui'
import type { Employee, Group, Attendance } from '../../types'

interface UserReportRow {
  date: string
  time_in: string | null
  time_out: string | null
  reason_in: string | null
  reason_out: string | null
  lat_in: number | null
  lng_in: number | null
  lat_out: number | null
  lng_out: number | null
  work_minutes: number
  late_minutes: number
  deduction_amount: number
}

export default function UserReportPage() {
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

  const [startDate, setStartDate] = useState(firstOfMonth)
  const [endDate, setEndDate]     = useState(today)
  const [groupFilter, setGroupFilter] = useState('all')
  const [userFilter, setUserFilter]   = useState('')

  const [groups, setGroups]       = useState<Group[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [rows, setRows]           = useState<UserReportRow[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)

  const [loading, setLoading]     = useState(false)
  const [page, setPage]           = useState(1)
  const [pageSize, setPageSize]   = useState(10)
  const [total, setTotal]         = useState(0)

  const [summary, setSummary] = useState({
    total_late: 0, total_deduction: 0, total_work_minutes: 0, total_payroll: 0
  })

  useEffect(() => {
    supabase.from('groups').select('id,name').order('name').then(({ data }) => setGroups((data as Group[]) || []))
    supabase.from('employees').select('id,full_name,employee_code').eq('is_active', true).order('full_name')
      .then(({ data }) => setEmployees((data as Employee[]) || []))
  }, [])

  const fetchReport = useCallback(async () => {
    if (!userFilter) return
    setLoading(true)
    try {
      const { data: emp } = await supabase
        .from('employees').select('*, group:groups(id,name)')
        .eq('id', userFilter).single()
      setSelectedEmployee(emp as Employee)

      const { data, count } = await supabase
        .from('attendances')
        .select('*', { count: 'exact' })
        .eq('employee_id', userFilter)
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate)
        .order('attendance_date', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1)

      setRows((data || []).map((r: Attendance) => ({
        date: r.attendance_date,
        time_in: r.time_in, time_out: r.time_out,
        reason_in: r.reason_in, reason_out: r.reason_out,
        lat_in: r.lat_in, lng_in: r.lng_in,
        lat_out: r.lat_out, lng_out: r.lng_out,
        work_minutes: r.work_minutes,
        late_minutes: r.late_minutes,
        deduction_amount: r.deduction_amount,
      })))
      setTotal(count || 0)

      const { data: all } = await supabase
        .from('attendances')
        .select('late_minutes,deduction_amount,work_minutes')
        .eq('employee_id', userFilter)
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate)

      if (all) {
        setSummary({
          total_late:         all.reduce((s, r) => s + (r.late_minutes || 0), 0),
          total_deduction:    all.reduce((s, r) => s + (r.deduction_amount || 0), 0),
          total_work_minutes: all.reduce((s, r) => s + (r.work_minutes || 0), 0),
          total_payroll:      0,
        })
      }
    } finally {
      setLoading(false)
    }
  }, [userFilter, startDate, endDate, page, pageSize])

  useEffect(() => { fetchReport() }, [fetchReport])

  const formatCoord = (lat: number | null, lng: number | null) => {
    if (!lat || !lng) return '-'
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  }

  const formatTimeStr = (ts: string | null) => {
    if (!ts) return '--:--'
    return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
  }

  return (
    <div>
      <h1 className="page-title mb-6">User Report</h1>

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
            <label className="form-label">Find a Group</label>
            <select className="form-input w-40" value={groupFilter}
              onChange={e => setGroupFilter(e.target.value)}>
              <option value="all">All Group</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Select User *</label>
            <select className="form-input w-52" value={userFilter}
              onChange={e => { setUserFilter(e.target.value); setPage(1) }}>
              <option value="">Pilih Karyawan</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.full_name}</option>
              ))}
            </select>
          </div>
          <button onClick={fetchReport} className="btn-primary">
            <Search size={14} /> Search
          </button>
          <button className="btn-secondary ml-auto">
            <Download size={14} /> Download Report
          </button>
        </div>
      </div>

      {userFilter ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Total Late',          value: formatMinutes(summary.total_late),         color: 'text-red-600' },
              { label: 'Total Deduction',     value: `Rp ${summary.total_deduction.toLocaleString('id-ID')}`, color: 'text-orange-600' },
              { label: 'Total Working Hours', value: formatMinutes(summary.total_work_minutes), color: 'text-green-600' },
              { label: 'Total Payroll',       value: `Rp ${summary.total_payroll.toLocaleString('id-ID')}`, color: 'text-blue-600' },
            ].map(s => (
              <div key={s.label} className="card p-4 text-center">
                <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="card">
            {selectedEmployee && (
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-sm font-semibold text-gray-900">User Report — {selectedEmployee.full_name}</p>
                <p className="text-xs text-gray-500">Employee Code: {selectedEmployee.employee_code}</p>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Time In</th>
                    <th>Time Out</th>
                    <th>Reason In</th>
                    <th>Reason Out</th>
                    <th>Location In</th>
                    <th>Location Out</th>
                    <th>Deduction</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="text-center py-16"><Spinner className="mx-auto" /></td></tr>
                  ) : rows.length === 0 ? (
                    <EmptyState message="Tidak ada data absensi" />
                  ) : (
                    rows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50/60">
                        <td>
                          <p className="text-xs text-gray-500">{row.date}</p>
                          <p className="font-medium text-sm">{formatTimeStr(row.time_in)}</p>
                        </td>
                        <td>
                          <p className="text-xs text-gray-500">{row.date}</p>
                          <p className="font-medium text-sm">{formatTimeStr(row.time_out)}</p>
                        </td>
                        <td className="text-gray-600 text-sm">{row.reason_in || '-'}</td>
                        <td className="text-gray-600 text-sm">{row.reason_out || '-'}</td>
                        <td className="font-mono text-xs text-gray-500">{formatCoord(row.lat_in, row.lng_in)}</td>
                        <td className="font-mono text-xs text-gray-500">{formatCoord(row.lat_out, row.lng_out)}</td>
                        <td className="text-gray-700">Rp {row.deduction_amount.toLocaleString('id-ID')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={setPageSize} />
          </div>
        </>
      ) : (
        <div className="card flex items-center justify-center py-20 text-gray-400 text-sm">
          Pilih karyawan untuk melihat laporan
        </div>
      )}
    </div>
  )
}
