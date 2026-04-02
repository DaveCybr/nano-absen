import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Search, Download, Columns, FileText, FileSpreadsheet } from 'lucide-react'
import { Spinner, EmptyState, Pagination, StatusBadge, LocationBadge, formatTime } from '../../components/ui'
import { exportCsv, exportXlsx, csvTime, csvMins } from '../../lib/exportCsv'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
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

const ALL_COLUMNS = [
  { key: 'attendance_date',     label: 'Tanggal' },
  { key: 'full_name',           label: 'Nama' },
  { key: 'employee_code',       label: 'Kode' },
  { key: 'group',               label: 'Grup' },
  { key: 'time_in',             label: 'Jam Masuk' },
  { key: 'status_in',           label: 'Status Masuk' },
  { key: 'location_in_status',  label: 'Lokasi Masuk' },
  { key: 'time_out',            label: 'Jam Keluar' },
  { key: 'status_out',          label: 'Status Keluar' },
  { key: 'work_minutes',        label: 'Jam Kerja' },
  { key: 'late_minutes',        label: 'Terlambat' },
] as const

type ColKey = typeof ALL_COLUMNS[number]['key']

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
  const [downloading, setDownloading] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadingXlsx, setDownloadingXlsx] = useState(false)

  // Column selector
  const [selectedCols, setSelectedCols] = useState<Set<ColKey>>(
    new Set(ALL_COLUMNS.map(c => c.key))
  )
  const [showColPicker, setShowColPicker] = useState(false)
  const colPickerRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setShowColPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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

  const toggleCol = (key: ColKey) => {
    setSelectedCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size === 1) return prev // must keep at least 1
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true)
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

      const activeCols = ALL_COLUMNS.filter(c => selectedCols.has(c.key))

      const doc = new jsPDF({ orientation: activeCols.length > 7 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })

      // Header
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Activity Report', 14, 16)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(120)
      doc.text(`Periode: ${startDate} s/d ${endDate}`, 14, 23)
      doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, 28)
      doc.setTextColor(0)

      const headers = activeCols.map(c => c.label)
      const rows = (data || []).map((r: any) =>
        activeCols.map(c => {
          switch (c.key) {
            case 'attendance_date':    return r.attendance_date ?? ''
            case 'full_name':          return r.employee?.full_name ?? ''
            case 'employee_code':      return r.employee?.employee_code ?? ''
            case 'group':              return r.employee?.group?.name ?? ''
            case 'time_in':            return csvTime(r.time_in)
            case 'status_in':          return r.status_in ?? ''
            case 'location_in_status': return r.location_in_status ?? ''
            case 'time_out':           return csvTime(r.time_out)
            case 'status_out':         return r.status_out ?? ''
            case 'work_minutes':       return csvMins(r.work_minutes)
            case 'late_minutes':       return csvMins(r.late_minutes)
            default:                   return ''
          }
        })
      )

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 33,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      })

      doc.save(`activity-report_${startDate}_${endDate}.pdf`)
    } finally {
      setDownloadingPdf(false)
    }
  }

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

      // Build headers and rows based on selected columns
      const activeCols = ALL_COLUMNS.filter(c => selectedCols.has(c.key))
      const headers = activeCols.map(c => c.label)

      const csvRows = (data || []).map((r: any) => {
        return activeCols.map(c => {
          switch (c.key) {
            case 'attendance_date':    return r.attendance_date ?? ''
            case 'full_name':          return r.employee?.full_name ?? ''
            case 'employee_code':      return r.employee?.employee_code ?? ''
            case 'group':              return r.employee?.group?.name ?? ''
            case 'time_in':            return csvTime(r.time_in)
            case 'status_in':          return r.status_in ?? ''
            case 'location_in_status': return r.location_in_status ?? ''
            case 'time_out':           return csvTime(r.time_out)
            case 'status_out':         return r.status_out ?? ''
            case 'work_minutes':       return csvMins(r.work_minutes)
            case 'late_minutes':       return csvMins(r.late_minutes)
            default:                   return ''
          }
        })
      })

      exportCsv(`activity-report_${startDate}_${endDate}`, headers, csvRows)
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadXlsx = async () => {
    setDownloadingXlsx(true)
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
      const activeCols = ALL_COLUMNS.filter(c => selectedCols.has(c.key))
      const headers = activeCols.map(c => c.label)
      const xlsxRows = (data || []).map((r: any) =>
        activeCols.map(c => {
          switch (c.key) {
            case 'attendance_date':    return r.attendance_date ?? ''
            case 'full_name':          return r.employee?.full_name ?? ''
            case 'employee_code':      return r.employee?.employee_code ?? ''
            case 'group':              return r.employee?.group?.name ?? ''
            case 'time_in':            return csvTime(r.time_in)
            case 'status_in':          return r.status_in ?? ''
            case 'location_in_status': return r.location_in_status ?? ''
            case 'time_out':           return csvTime(r.time_out)
            case 'status_out':         return r.status_out ?? ''
            case 'work_minutes':       return r.work_minutes ?? 0
            case 'late_minutes':       return r.late_minutes ?? 0
            default:                   return ''
          }
        })
      )
      exportXlsx(`activity-report_${startDate}_${endDate}`, headers, xlsxRows)
    } finally {
      setDownloadingXlsx(false)
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

          {/* Column picker + Download — right side */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Column selector dropdown */}
            <div className="relative" ref={colPickerRef}>
              <button
                onClick={() => setShowColPicker(v => !v)}
                className="btn-secondary"
                title="Pilih kolom export"
              >
                <Columns size={14} />
                Kolom ({selectedCols.size}/{ALL_COLUMNS.length})
              </button>
              {showColPicker && (
                <div className="absolute right-0 top-full mt-1.5 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-2 min-w-[180px]">
                  <div className="px-3 pb-1.5 mb-1 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kolom CSV</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedCols(new Set(ALL_COLUMNS.map(c => c.key)))}
                        className="text-xs text-blue-500 hover:underline"
                      >
                        Semua
                      </button>
                      <span className="text-gray-200">|</span>
                      <button
                        onClick={() => setSelectedCols(new Set([ALL_COLUMNS[0].key]))}
                        className="text-xs text-gray-400 hover:underline"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  {ALL_COLUMNS.map(col => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-gray-50 select-none"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCols.has(col.key)}
                        onChange={() => toggleCol(col.key)}
                        className="w-3.5 h-3.5 accent-blue-600 rounded"
                      />
                      <span className="text-sm text-gray-700">{col.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button onClick={handleDownload} disabled={downloading} className="btn-secondary">
              {downloading
                ? <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                : <Download size={14} />}
              {downloading ? 'Mengunduh...' : 'CSV'}
            </button>

            <button onClick={handleDownloadPdf} disabled={downloadingPdf} className="btn-secondary text-red-600 border-red-200 hover:bg-red-50">
              {downloadingPdf
                ? <span className="w-3.5 h-3.5 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                : <FileText size={14} />}
              {downloadingPdf ? 'Mengunduh...' : 'PDF'}
            </button>

            <button onClick={handleDownloadXlsx} disabled={downloadingXlsx} className="btn-secondary text-green-700 border-green-200 hover:bg-green-50">
              {downloadingXlsx
                ? <span className="w-3.5 h-3.5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                : <FileSpreadsheet size={14} />}
              {downloadingXlsx ? 'Mengunduh...' : 'Excel'}
            </button>
          </div>
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
