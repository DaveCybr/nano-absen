import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Download, Search } from 'lucide-react'
import { Spinner, EmptyState, Pagination } from '../../components/ui'
import type { Group } from '../../types'

interface SummaryRow {
  employee_id: string
  full_name: string
  position: string
  group_name: string
  on_time: number
  in_tolerance: number
  late: number
  leave: number
  correction_time: number
  in_location: number
  tolerance_location: number
  out_location: number
  correction_location: number
  total_present: number
  absent: number
}

export default function UserSummaryPage() {
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

  const [startDate, setStartDate] = useState(firstOfMonth)
  const [endDate, setEndDate]     = useState(today)
  const [groupFilter, setGroupFilter] = useState('all')
  const [groups, setGroups]   = useState<Group[]>([])
  const [rows, setRows]       = useState<SummaryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage]       = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal]     = useState(0)

  useEffect(() => {
    supabase.from('groups').select('id,name').order('name')
      .then(({ data }) => setGroups((data as Group[]) || []))
  }, [])

  const workingDays = Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000
  ) + 1

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    try {
      let empQuery = supabase
        .from('employees')
        .select('id,full_name,employee_code,group:groups(name),position:positions(name)')
        .eq('is_active', true)
        .order('full_name')

      if (groupFilter !== 'all') empQuery = empQuery.eq('group_id', groupFilter)

      const { data: employees } = await empQuery
      if (!employees) { setLoading(false); return }

      setTotal(employees.length)
      const paginated = employees.slice((page - 1) * pageSize, page * pageSize)

      const results: SummaryRow[] = await Promise.all(
        paginated.map(async (emp: any) => {
          const { data } = await supabase
            .from('attendances')
            .select('status_in,location_in_status,time_out')
            .eq('employee_id', emp.id)
            .gte('attendance_date', startDate)
            .lte('attendance_date', endDate)

          const d = data || []
          const total_present = d.filter(r => r.time_out).length

          return {
            employee_id:         emp.id,
            full_name:           emp.full_name,
            position:            emp.position?.name || '-',
            group_name:          emp.group?.name || '-',
            on_time:             d.filter(r => r.status_in === 'on_time').length,
            in_tolerance:        d.filter(r => r.status_in === 'in_tolerance').length,
            late:                d.filter(r => r.status_in === 'late').length,
            leave:               0,
            correction_time:     d.filter(r => r.status_in === 'others').length,
            in_location:         d.filter(r => r.location_in_status === 'in_area').length,
            tolerance_location:  d.filter(r => r.location_in_status === 'tolerance').length,
            out_location:        d.filter(r => r.location_in_status === 'out_of_area').length,
            correction_location: d.filter(r => r.location_in_status === 'correction').length,
            total_present,
            absent:              Math.max(0, workingDays - d.length),
          }
        })
      )

      setRows(results)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, groupFilter, page, pageSize, workingDays])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  const numCell = (val: number, color = 'text-gray-700') => (
    <td className={`text-center font-medium ${val > 0 ? color : 'text-gray-400'}`}>{val}</td>
  )

  return (
    <div>
      <h1 className="page-title mb-6">User Summary</h1>

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
            <label className="form-label">Select Group</label>
            <select className="form-input w-40" value={groupFilter}
              onChange={e => { setGroupFilter(e.target.value); setPage(1) }}>
              <option value="all">All Group</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <button onClick={fetchSummary} className="btn-primary">
            <Search size={14} /> Search
          </button>
          <button className="btn-secondary ml-auto">
            <Download size={14} /> Download Report
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="data-table w-full text-xs">
          <thead>
            <tr>
              <th className="text-left min-w-[140px]">Employee Name</th>
              <th>Position</th>
              <th>Group</th>
              <th className="text-center text-green-600">On Time</th>
              <th className="text-center text-yellow-600">In Tolerance</th>
              <th className="text-center text-red-600">Late</th>
              <th className="text-center text-purple-600">Leave</th>
              <th className="text-center text-blue-600">Correction Time</th>
              <th className="text-center text-green-600">In Location</th>
              <th className="text-center text-yellow-600">Tolerance Location</th>
              <th className="text-center text-red-600">Out of Location</th>
              <th className="text-center text-blue-600">Correction Location</th>
              <th className="text-center text-gray-700 font-bold">Total Present</th>
              <th className="text-center text-red-700">Absent</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={14} className="text-center py-16"><Spinner className="mx-auto" /></td></tr>
            ) : rows.length === 0 ? (
              <EmptyState message="Tidak ada data" />
            ) : (
              rows.map(row => (
                <tr key={row.employee_id} className="hover:bg-gray-50/60">
                  <td className="font-medium text-gray-900">{row.full_name}</td>
                  <td className="text-gray-500">{row.position}</td>
                  <td><span className="badge badge-gray">{row.group_name}</span></td>
                  {numCell(row.on_time, 'text-green-600')}
                  {numCell(row.in_tolerance, 'text-yellow-600')}
                  {numCell(row.late, 'text-red-600')}
                  {numCell(row.leave, 'text-purple-600')}
                  {numCell(row.correction_time, 'text-blue-600')}
                  {numCell(row.in_location, 'text-green-600')}
                  {numCell(row.tolerance_location, 'text-yellow-600')}
                  {numCell(row.out_location, 'text-red-600')}
                  {numCell(row.correction_location, 'text-blue-600')}
                  <td className="text-center font-bold text-gray-900">{row.total_present}</td>
                  {numCell(row.absent, 'text-red-700')}
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={setPageSize} />
      </div>
    </div>
  )
}
