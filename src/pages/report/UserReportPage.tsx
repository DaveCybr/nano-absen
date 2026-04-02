import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Download, Search, Columns, FileText, FileSpreadsheet } from 'lucide-react'
import { Spinner, EmptyState, Pagination, formatMinutes } from '../../components/ui'
import { exportCsv, exportXlsx, csvTime, csvMins } from '../../lib/exportCsv'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
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

const ALL_COLUMNS = [
  { key: 'date',             label: 'Tanggal' },
  { key: 'time_in',          label: 'Jam Masuk' },
  { key: 'time_out',         label: 'Jam Keluar' },
  { key: 'reason_in',        label: 'Alasan Masuk' },
  { key: 'reason_out',       label: 'Alasan Keluar' },
  { key: 'coord_in',         label: 'Koordinat Masuk' },
  { key: 'coord_out',        label: 'Koordinat Keluar' },
  { key: 'work_minutes',     label: 'Jam Kerja' },
  { key: 'late_minutes',     label: 'Terlambat' },
  { key: 'deduction_amount', label: 'Potongan (Rp)' },
] as const

type ColKey = typeof ALL_COLUMNS[number]['key']

export default function UserReportPage() {
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

  const [startDate, setStartDate]     = useState(firstOfMonth)
  const [endDate, setEndDate]         = useState(today)
  const [groupFilter, setGroupFilter] = useState('all')
  const [userFilter, setUserFilter]   = useState('')

  const [groups, setGroups]       = useState<Group[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [rows, setRows]           = useState<UserReportRow[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)

  const [loading, setLoading]   = useState(false)
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal]       = useState(0)
  const [summary, setSummary]   = useState({ total_late: 0, total_deduction: 0, total_work_minutes: 0, total_payroll: 0 })

  const [selectedCols, setSelectedCols]   = useState<Set<ColKey>>(new Set(ALL_COLUMNS.map(c => c.key)))
  const [showColPicker, setShowColPicker] = useState(false)
  const colPickerRef = useRef<HTMLDivElement>(null)

  const [downloading, setDownloading]         = useState(false)
  const [downloadingPdf, setDownloadingPdf]   = useState(false)
  const [downloadingXlsx, setDownloadingXlsx] = useState(false)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node))
        setShowColPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    supabase.from('groups').select('id,name').order('name').then(({ data }) => setGroups((data as Group[]) || []))
    supabase.from('employees').select('id,full_name,employee_code').eq('is_active', true).order('full_name')
      .then(({ data }) => setEmployees((data as Employee[]) || []))
  }, [])

  const toggleCol = (key: ColKey) => {
    setSelectedCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) { if (next.size === 1) return prev; next.delete(key) }
      else next.add(key)
      return next
    })
  }

  const getCellStr = (r: Attendance, key: ColKey): string => {
    switch (key) {
      case 'date':             return r.attendance_date
      case 'time_in':          return csvTime(r.time_in)
      case 'time_out':         return csvTime(r.time_out)
      case 'reason_in':        return r.reason_in ?? '-'
      case 'reason_out':       return r.reason_out ?? '-'
      case 'coord_in':         return r.lat_in && r.lng_in ? `${r.lat_in},${r.lng_in}` : '-'
      case 'coord_out':        return r.lat_out && r.lng_out ? `${r.lat_out},${r.lng_out}` : '-'
      case 'work_minutes':     return csvMins(r.work_minutes)
      case 'late_minutes':     return csvMins(r.late_minutes)
      case 'deduction_amount': return `Rp ${(r.deduction_amount ?? 0).toLocaleString('id-ID')}`
      default:                 return ''
    }
  }

  const getCellXlsx = (r: Attendance, key: ColKey): string | number => {
    switch (key) {
      case 'date':             return r.attendance_date
      case 'time_in':          return csvTime(r.time_in)
      case 'time_out':         return csvTime(r.time_out)
      case 'reason_in':        return r.reason_in ?? '-'
      case 'reason_out':       return r.reason_out ?? '-'
      case 'coord_in':         return r.lat_in && r.lng_in ? `${r.lat_in},${r.lng_in}` : '-'
      case 'coord_out':        return r.lat_out && r.lng_out ? `${r.lat_out},${r.lng_out}` : '-'
      case 'work_minutes':     return r.work_minutes ?? 0
      case 'late_minutes':     return r.late_minutes ?? 0
      case 'deduction_amount': return r.deduction_amount ?? 0
      default:                 return ''
    }
  }

  const fetchAllData = async () => {
    if (!userFilter) return []
    const { data } = await supabase
      .from('attendances').select('*')
      .eq('employee_id', userFilter)
      .gte('attendance_date', startDate).lte('attendance_date', endDate)
      .order('attendance_date', { ascending: false })
    return (data || []) as Attendance[]
  }

  const handleDownload = async () => {
    if (!userFilter || !selectedEmployee) return
    setDownloading(true)
    try {
      const data = await fetchAllData()
      const activeCols = ALL_COLUMNS.filter(c => selectedCols.has(c.key))
      exportCsv(
        `user-report_${selectedEmployee.employee_code}_${startDate}_${endDate}`,
        activeCols.map(c => c.label),
        data.map(r => activeCols.map(c => getCellStr(r, c.key))),
      )
    } finally { setDownloading(false) }
  }

  const handleDownloadPdf = async () => {
    if (!userFilter || !selectedEmployee) return
    setDownloadingPdf(true)
    try {
      const data = await fetchAllData()
      const activeCols = ALL_COLUMNS.filter(c => selectedCols.has(c.key))
      const doc = new jsPDF({ orientation: activeCols.length > 5 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
      doc.setFontSize(14); doc.setFont('helvetica', 'bold')
      doc.text(`User Report — ${selectedEmployee.full_name}`, 14, 16)
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(120)
      doc.text(`Kode: ${selectedEmployee.employee_code}   Periode: ${startDate} s/d ${endDate}`, 14, 23)
      doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, 28)
      doc.setTextColor(0)
      autoTable(doc, {
        head: [activeCols.map(c => c.label)],
        body: data.map(r => activeCols.map(c => getCellStr(r, c.key))),
        startY: 33,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      })
      doc.save(`user-report_${selectedEmployee.employee_code}_${startDate}_${endDate}.pdf`)
    } finally { setDownloadingPdf(false) }
  }

  const handleDownloadXlsx = async () => {
    if (!userFilter || !selectedEmployee) return
    setDownloadingXlsx(true)
    try {
      const data = await fetchAllData()
      const activeCols = ALL_COLUMNS.filter(c => selectedCols.has(c.key))
      exportXlsx(
        `user-report_${selectedEmployee.employee_code}_${startDate}_${endDate}`,
        activeCols.map(c => c.label),
        data.map(r => activeCols.map(c => getCellXlsx(r, c.key))),
      )
    } finally { setDownloadingXlsx(false) }
  }

  const fetchReport = useCallback(async () => {
    if (!userFilter) return
    setLoading(true)
    try {
      const { data: emp } = await supabase.from('employees').select('*, group:groups(id,name)').eq('id', userFilter).single()
      setSelectedEmployee(emp as Employee)

      const { data, count } = await supabase.from('attendances').select('*', { count: 'exact' })
        .eq('employee_id', userFilter)
        .gte('attendance_date', startDate).lte('attendance_date', endDate)
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

      const { data: all } = await supabase.from('attendances').select('late_minutes,deduction_amount,work_minutes')
        .eq('employee_id', userFilter)
        .gte('attendance_date', startDate).lte('attendance_date', endDate)
      if (all) {
        setSummary({
          total_late:         all.reduce((s, r) => s + (r.late_minutes || 0), 0),
          total_deduction:    all.reduce((s, r) => s + (r.deduction_amount || 0), 0),
          total_work_minutes: all.reduce((s, r) => s + (r.work_minutes || 0), 0),
          total_payroll: 0,
        })
      }
    } finally { setLoading(false) }
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
            <select className="form-input w-40" value={groupFilter} onChange={e => setGroupFilter(e.target.value)}>
              <option value="all">All Group</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Select User *</label>
            <select className="form-input w-52" value={userFilter}
              onChange={e => { setUserFilter(e.target.value); setPage(1) }}>
              <option value="">Pilih Karyawan</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </div>
          <button onClick={fetchReport} className="btn-primary"><Search size={14} /> Search</button>

          {userFilter && (
            <div className="flex items-center gap-2 ml-auto">
              <div className="relative" ref={colPickerRef}>
                <button onClick={() => setShowColPicker(v => !v)} className="btn-secondary" title="Pilih kolom export">
                  <Columns size={14} /> Kolom ({selectedCols.size}/{ALL_COLUMNS.length})
                </button>
                {showColPicker && (
                  <div className="absolute right-0 top-full mt-1.5 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-2 min-w-[180px]">
                    <div className="px-3 pb-1.5 mb-1 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kolom</span>
                      <div className="flex gap-2">
                        <button onClick={() => setSelectedCols(new Set(ALL_COLUMNS.map(c => c.key)))} className="text-xs text-blue-500 hover:underline">Semua</button>
                        <span className="text-gray-200">|</span>
                        <button onClick={() => setSelectedCols(new Set([ALL_COLUMNS[0].key]))} className="text-xs text-gray-400 hover:underline">Reset</button>
                      </div>
                    </div>
                    {ALL_COLUMNS.map(col => (
                      <label key={col.key} className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-gray-50 select-none">
                        <input type="checkbox" checked={selectedCols.has(col.key)} onChange={() => toggleCol(col.key)} className="w-3.5 h-3.5 accent-blue-600 rounded" />
                        <span className="text-sm text-gray-700">{col.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={handleDownload} disabled={downloading} className="btn-secondary">
                {downloading ? <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Download size={14} />}
                {downloading ? 'Mengunduh...' : 'CSV'}
              </button>
              <button onClick={handleDownloadPdf} disabled={downloadingPdf} className="btn-secondary text-red-600 border-red-200 hover:bg-red-50">
                {downloadingPdf ? <span className="w-3.5 h-3.5 border-2 border-red-300 border-t-transparent rounded-full animate-spin" /> : <FileText size={14} />}
                {downloadingPdf ? 'Mengunduh...' : 'PDF'}
              </button>
              <button onClick={handleDownloadXlsx} disabled={downloadingXlsx} className="btn-secondary text-green-700 border-green-200 hover:bg-green-50">
                {downloadingXlsx ? <span className="w-3.5 h-3.5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" /> : <FileSpreadsheet size={14} />}
                {downloadingXlsx ? 'Mengunduh...' : 'Excel'}
              </button>
            </div>
          )}
        </div>
      </div>

      {userFilter ? (
        <>
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
