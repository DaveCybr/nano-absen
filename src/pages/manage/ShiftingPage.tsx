import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Edit2, Trash2, ChevronLeft, ChevronRight, Upload, Download, AlertCircle, CheckCircle, FileSpreadsheet } from 'lucide-react'
import { Spinner, Modal } from '../../components/ui'
import type { ShiftCode, Employee, Group, Schedule } from '../../types'
import clsx from 'clsx'
import * as XLSX from 'xlsx'

type Tab = 'schedule' | 'shift_code'

const DAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

function getWeekDates(refDate: Date): Date[] {
  const day = refDate.getDay()
  const monday = new Date(refDate)
  monday.setDate(refDate.getDate() - day + 1)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export default function ShiftingPage() {
  const [tab, setTab] = useState<Tab>('schedule')

  const [weekRef, setWeekRef]         = useState(new Date())
  const [groupFilter, setGroupFilter] = useState('all')
  const [userFilter, setUserFilter]   = useState('all')
  const [groups, setGroups]           = useState<Group[]>([])
  const [employees, setEmployees]     = useState<Employee[]>([])
  const [schedules, setSchedules]     = useState<Schedule[]>([])
  const [shiftCodes, setShiftCodes]   = useState<ShiftCode[]>([])
  const [loadingSched, setLoadingSched] = useState(false)

  // Assign schedule state
  const [assignModal, setAssignModal] = useState(false)
  const [assignEmp, setAssignEmp]     = useState<Employee | null>(null)
  const [assignDate, setAssignDate]   = useState('')
  const [assignShiftId, setAssignShiftId] = useState('')
  const [savingAssign, setSavingAssign]   = useState(false)
  const [assignError, setAssignError]     = useState('')

  // Bulk assign state
  const [bulkModal, setBulkModal]         = useState(false)
  const [bulkEmp, setBulkEmp]             = useState<Employee | null>(null)
  const [bulkShiftId, setBulkShiftId]     = useState('')
  const [bulkDates, setBulkDates]         = useState<string[]>([])
  const [savingBulk, setSavingBulk]       = useState(false)
  const [bulkError, setBulkError]         = useState('')

  // Upload schedule state
  const [uploadModal, setUploadModal]   = useState(false)
  const [uploadFile, setUploadFile]     = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<{ headers: string[]; rows: string[][] }>({ headers: [], rows: [] })
  const [uploading, setUploading]       = useState(false)
  const [uploadResult, setUploadResult] = useState<{ success: number; skipped: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [savingCode, setSavingCode]       = useState(false)
  const [codeModalOpen, setCodeModalOpen] = useState(false)
  const [editCode, setEditCode]           = useState<ShiftCode | null>(null)
  const [deleteCode, setDeleteCode]       = useState<ShiftCode | null>(null)
  const [codeError, setCodeError]         = useState('')
  const [deleteCodeError, setDeleteCodeError] = useState('')
  const [fCode, setFCode]     = useState('')
  const [fTitle, setFTitle]   = useState('')
  const [fIn, setFIn]         = useState('08:00')
  const [fOut, setFOut]       = useState('16:00')
  const [fTol, setFTol]       = useState('0')
  const [fHoliday, setFHoliday] = useState(false)

  const weekDates = getWeekDates(weekRef)
  const weekStart = weekDates[0].toISOString().split('T')[0]
  const weekEnd   = weekDates[6].toISOString().split('T')[0]

  useEffect(() => {
    supabase.from('groups').select('id,name').order('name').then(({ data }) => setGroups((data as Group[]) || []))
    supabase.from('shift_codes').select('*').order('code').then(({ data }) => setShiftCodes((data as ShiftCode[]) || []))
  }, [])

  useEffect(() => {
    let q = supabase.from('employees').select('id,full_name,employee_code,group_id').eq('is_active', true).order('full_name')
    if (groupFilter !== 'all') q = q.eq('group_id', groupFilter)
    q.then(({ data }) => setEmployees((data as Employee[]) || []))
  }, [groupFilter])

  const fetchSchedules = useCallback(async () => {
    setLoadingSched(true)
    let q = supabase
      .from('schedules')
      .select('*, shift_code:shift_codes(id,code,title,is_holiday)')
      .gte('schedule_date', weekStart)
      .lte('schedule_date', weekEnd)
    if (groupFilter !== 'all' && employees.length > 0) {
      q = q.in('employee_id', employees.map(e => e.id))
    }
    const { data } = await q
    setSchedules((data as Schedule[]) || [])
    setLoadingSched(false)
  }, [weekStart, weekEnd, groupFilter, employees])

  useEffect(() => { fetchSchedules() }, [fetchSchedules])

  const getSchedule = (empId: string, date: Date) => {
    const d = date.toISOString().split('T')[0]
    return schedules.find(s => s.employee_id === empId && s.schedule_date === d)
  }

  const openAddCode = () => {
    setEditCode(null)
    setFCode(''); setFTitle(''); setFIn('08:00'); setFOut('16:00'); setFTol('0'); setFHoliday(false)
    setCodeError('')
    setCodeModalOpen(true)
  }

  const openEditCode = (sc: ShiftCode) => {
    setEditCode(sc)
    setFCode(sc.code); setFTitle(sc.title)
    setFIn(sc.work_in || '08:00'); setFOut(sc.work_out || '16:00')
    setFTol(String(sc.tolerance_minutes)); setFHoliday(sc.is_holiday)
    setCodeError('')
    setCodeModalOpen(true)
  }

  const handleSaveCode = async () => {
    if (!fCode.trim()) { setCodeError('Kode shift wajib diisi'); return }
    if (!fTitle.trim()) { setCodeError('Judul shift wajib diisi'); return }
    setCodeError('')
    setSavingCode(true)

    const payload = {
      code: fCode, title: fTitle,
      work_in:  fHoliday ? null : fIn,
      work_out: fHoliday ? null : fOut,
      tolerance_minutes: parseInt(fTol) || 0,
      is_holiday: fHoliday,
    }

    try {
      if (editCode) {
        const { error } = await supabase.from('shift_codes').update(payload).eq('id', editCode.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('shift_codes').insert(payload)
        if (error) throw error
      }
      setCodeModalOpen(false)
      const { data } = await supabase.from('shift_codes').select('*').order('code')
      setShiftCodes((data as ShiftCode[]) || [])
    } catch (err: any) {
      setCodeError(err.message)
    } finally {
      setSavingCode(false)
    }
  }

  const handleDeleteCode = async () => {
    if (!deleteCode) return
    setDeleteCodeError('')
    const { count } = await supabase
      .from('schedules')
      .select('id', { count: 'exact', head: true })
      .eq('shift_code_id', deleteCode.id)
    if (count && count > 0) {
      setDeleteCodeError(`Tidak bisa dihapus — shift code ini digunakan oleh ${count} jadwal. Hapus atau ubah jadwal terlebih dahulu.`)
      return
    }
    await supabase.from('shift_codes').delete().eq('id', deleteCode.id)
    setDeleteCode(null)
    const { data } = await supabase.from('shift_codes').select('*').order('code')
    setShiftCodes((data as ShiftCode[]) || [])
  }

  // ── Download template ───────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const dateHeaders = weekDates.map(d => d.toISOString().split('T')[0])
    const headerRow = ['Kode Karyawan', 'Nama Karyawan', ...dateHeaders]

    const dataRows = employees.map(emp => {
      const row: string[] = [emp.employee_code, emp.full_name]
      weekDates.forEach(d => {
        const sched = getSchedule(emp.id, d)
        row.push(sched?.shift_code?.code || '')
      })
      return row
    })

    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])
    // Column widths
    ws['!cols'] = [{ wch: 16 }, { wch: 28 }, ...dateHeaders.map(() => ({ wch: 12 }))]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Schedule')

    // Info sheet
    const infoRows = [
      ['FORMAT TEMPLATE JADWAL SHIFT'],
      [''],
      ['Kolom A : Kode karyawan (jangan diubah)'],
      ['Kolom B : Nama karyawan (jangan diubah)'],
      ['Kolom C+ : Isi dengan Kode Shift atau kosongkan'],
      [''],
      ['Kode Shift yang tersedia:'],
      ['Kode', 'Judul', 'Masuk', 'Keluar'],
      ...shiftCodes.map(sc => [sc.code, sc.title, sc.work_in || '-', sc.work_out || '-']),
    ]
    const wsInfo = XLSX.utils.aoa_to_sheet(infoRows)
    wsInfo['!cols'] = [{ wch: 20 }, { wch: 24 }, { wch: 10 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Info')

    XLSX.writeFile(wb, `template-jadwal_${weekStart}_${weekEnd}.xlsx`)
  }

  // ── Parse uploaded file ──────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadFile(file)
    setUploadResult(null)

    const reader = new FileReader()
    reader.onload = evt => {
      const data = evt.target?.result
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const aoa: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      if (!aoa.length) return
      const [headerRow, ...dataRows] = aoa
      setUploadPreview({
        headers: headerRow.map(String),
        rows: dataRows.slice(0, 5).map(r => r.map(String)),
      })
    }
    reader.readAsArrayBuffer(file)
  }

  // ── Import to database ───────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!uploadFile) return
    setUploading(true)
    setUploadResult(null)

    const reader = new FileReader()
    reader.onload = async evt => {
      try {
        const data = evt.target?.result
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const aoa: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        if (aoa.length < 2) { setUploading(false); return }

        const [headerRow, ...dataRows] = aoa
        // Date columns start at index 2
        const dateColumns = headerRow.slice(2).map(String)

        // Fetch all employees & shift codes for matching
        const { data: allEmps } = await supabase.from('employees').select('id,employee_code').eq('is_active', true)
        const { data: allShifts } = await supabase.from('shift_codes').select('id,code')

        const empMap = Object.fromEntries((allEmps || []).map(e => [e.employee_code.trim().toUpperCase(), e.id]))
        const shiftMap = Object.fromEntries((allShifts || []).map(s => [s.code.trim().toUpperCase(), s.id]))

        const upserts: { employee_id: string; schedule_date: string; shift_code_id: string }[] = []
        const deletes: { employee_id: string; schedule_date: string }[] = []
        const skipped: string[] = []

        for (const row of dataRows) {
          const empCode = String(row[0] || '').trim().toUpperCase()
          if (!empCode) continue
          const empId = empMap[empCode]
          if (!empId) { skipped.push(`Kode karyawan tidak ditemukan: "${row[0]}"`); continue }

          dateColumns.forEach((dateStr, idx) => {
            if (!dateStr) return
            const shiftRaw = String(row[idx + 2] || '').trim().toUpperCase()
            if (!shiftRaw) {
              deletes.push({ employee_id: empId, schedule_date: dateStr })
              return
            }
            const shiftId = shiftMap[shiftRaw]
            if (!shiftId) { skipped.push(`Kode shift tidak dikenal: "${row[idx + 2]}" (baris ${empCode}, ${dateStr})`); return }
            upserts.push({ employee_id: empId, schedule_date: dateStr, shift_code_id: shiftId })
          })
        }

        // Batch upsert
        let successCount = 0
        if (upserts.length) {
          const { error } = await supabase.from('schedules').upsert(upserts, { onConflict: 'employee_id,schedule_date' })
          if (error) { skipped.push(`Error upsert: ${error.message}`) }
          else successCount += upserts.length
        }

        // Batch delete (cells explicitly left empty)
        for (const d of deletes) {
          await supabase.from('schedules').delete().eq('employee_id', d.employee_id).eq('schedule_date', d.schedule_date)
        }

        setUploadResult({ success: successCount, skipped: [...new Set(skipped)] })
        fetchSchedules()
      } finally {
        setUploading(false)
      }
    }
    reader.readAsArrayBuffer(uploadFile)
  }

  const openBulkAssign = (emp: Employee) => {
    setBulkEmp(emp)
    setBulkShiftId('')
    setBulkDates(weekDates.map(d => d.toISOString().split('T')[0]))
    setBulkError('')
    setBulkModal(true)
  }

  const handleSaveBulk = async () => {
    if (!bulkEmp || bulkDates.length === 0) return
    setSavingBulk(true)
    setBulkError('')
    try {
      if (!bulkShiftId) {
        // Batch delete all selected dates
        const { error } = await supabase.from('schedules')
          .delete()
          .eq('employee_id', bulkEmp.id)
          .in('schedule_date', bulkDates)
        if (error) throw error
      } else {
        const upserts = bulkDates.map(date => ({
          employee_id: bulkEmp.id,
          schedule_date: date,
          shift_code_id: bulkShiftId,
        }))
        const { error } = await supabase.from('schedules')
          .upsert(upserts, { onConflict: 'employee_id,schedule_date' })
        if (error) throw error
      }
      setBulkModal(false)
      fetchSchedules()
    } catch (err: any) {
      setBulkError(err.message)
    } finally {
      setSavingBulk(false)
    }
  }

  const openAssign = (emp: Employee, date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    const existing = getSchedule(emp.id, date)
    setAssignEmp(emp)
    setAssignDate(dateStr)
    setAssignShiftId(existing?.shift_code_id || '')
    setAssignError('')
    setAssignModal(true)
  }

  const handleSaveAssign = async () => {
    if (!assignEmp) return
    setSavingAssign(true)
    setAssignError('')

    try {
      const existing = schedules.find(
        s => s.employee_id === assignEmp.id && s.schedule_date === assignDate
      )

      if (!assignShiftId) {
        // Remove schedule
        if (existing) {
          const { error } = await supabase.from('schedules').delete().eq('id', existing.id)
          if (error) throw error
        }
      } else {
        // Upsert schedule
        const payload = { employee_id: assignEmp.id, schedule_date: assignDate, shift_code_id: assignShiftId }
        if (existing) {
          const { error } = await supabase.from('schedules').update(payload).eq('id', existing.id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('schedules').insert(payload)
          if (error) throw error
        }
      }

      setAssignModal(false)
      fetchSchedules()
    } catch (err: any) {
      setAssignError(err.message)
    } finally {
      setSavingAssign(false)
    }
  }

  const displayedEmployees = userFilter === 'all'
    ? employees
    : employees.filter(e => e.id === userFilter)

  return (
    <div>
      <h1 className="page-title mb-6">Shifting</h1>

      <div className="card">
        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-4 gap-1">
          {[
            { id: 'schedule' as Tab,   label: 'Schedule Shifting' },
            { id: 'shift_code' as Tab, label: 'Manage Shift Code' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Schedule tab */}
        {tab === 'schedule' && (
          <div className="p-4">
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div>
                <label className="form-label">Find a Group</label>
                <select className="form-input w-40" value={groupFilter} onChange={e => setGroupFilter(e.target.value)}>
                  <option value="all">All Group</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Find a User</label>
                <select className="form-input w-44" value={userFilter} onChange={e => setUserFilter(e.target.value)}>
                  <option value="all">All User</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button onClick={handleDownloadTemplate} className="btn-secondary">
                  <FileSpreadsheet size={14} /> Export Schedule
                </button>
                <button onClick={() => { setUploadFile(null); setUploadPreview({ headers: [], rows: [] }); setUploadResult(null); setUploadModal(true) }}
                  className="btn-secondary"><Upload size={14} /> Upload Schedule</button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { const d = new Date(weekRef); d.setDate(d.getDate() - 7); setWeekRef(d) }}
                  className="btn-icon"><ChevronLeft size={16} /></button>
                <button onClick={() => setWeekRef(new Date())} className="btn-secondary text-xs px-3 py-2">Today</button>
                <button onClick={() => { const d = new Date(weekRef); d.setDate(d.getDate() + 7); setWeekRef(d) }}
                  className="btn-icon"><ChevronRight size={16} /></button>
              </div>
            </div>

            {loadingSched ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-100 rounded-xl overflow-hidden">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-100 min-w-[160px]">
                        Employee Name
                      </th>
                      {weekDates.map((d, i) => (
                        <th key={i} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 border-b border-gray-100 min-w-[110px]">
                          {DAYS_ID[d.getDay()]}, {d.getDate()} {d.toLocaleString('id-ID', { month: 'short' })} {d.getFullYear()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedEmployees.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-12 text-gray-400">Belum ada karyawan</td></tr>
                    ) : (
                      displayedEmployees.map(emp => (
                        <tr key={emp.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-3">
                            <button
                              onClick={() => openBulkAssign(emp)}
                              className="font-medium text-gray-900 hover:text-blue-600 text-left w-full"
                              title="Bulk assign shift untuk karyawan ini"
                            >
                              {emp.full_name}
                            </button>
                          </td>
                          {weekDates.map((d, i) => {
                            const sched = getSchedule(emp.id, d)
                            return (
                              <td key={i} className="px-3 py-2 text-center">
                                <button
                                  onClick={() => openAssign(emp, d)}
                                  className="w-full min-h-[36px] rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center"
                                  title="Klik untuk atur jadwal"
                                >
                                  {sched ? (
                                    <span className={clsx('badge text-xs', sched.shift_code?.is_holiday ? 'badge-red' : 'badge-blue')}>
                                      {sched.shift_code?.code || '-'}
                                    </span>
                                  ) : (
                                    <span className="text-gray-200 hover:text-blue-300 text-lg leading-none">+</span>
                                  )}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Shift Code tab */}
        {tab === 'shift_code' && (
          <div>
            <div className="flex items-center justify-end px-4 py-3 border-b border-gray-50">
              <button onClick={openAddCode} className="btn-primary"><Plus size={14} /> Add Shift Code</button>
            </div>
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Shift Code</th>
                  <th>Title</th>
                  <th>Work In</th>
                  <th>Work Out</th>
                  <th>Tolerances</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {shiftCodes.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400">Belum ada shift code</td></tr>
                ) : (
                  shiftCodes.map(sc => (
                    <tr key={sc.id} className="hover:bg-gray-50/60">
                      <td className="font-mono font-medium">{sc.code}</td>
                      <td className="font-medium">
                        {sc.title}
                        {sc.is_holiday && <span className="ml-2 badge badge-red text-xs">Libur</span>}
                      </td>
                      <td className="font-mono text-gray-600">{sc.work_in || '-'}</td>
                      <td className="font-mono text-gray-600">{sc.work_out || '-'}</td>
                      <td className="text-gray-600">{sc.is_holiday ? '-' : `${sc.tolerance_minutes} menit`}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditCode(sc)} className="btn-icon text-blue-500"><Edit2 size={14} /></button>
                          <button onClick={() => setDeleteCode(sc)} className="btn-icon text-red-400"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Shift Code Modal */}
      <Modal open={codeModalOpen} onClose={() => setCodeModalOpen(false)}
        title={editCode ? 'Edit Shift Code' : 'Add Shift Code'} width="max-w-sm">
        <div className="space-y-3">
          {codeError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{codeError}</div>}
          <div>
            <label className="form-label">Shift Code *</label>
            <input className="form-input font-mono" value={fCode} onChange={e => setFCode(e.target.value)} placeholder="A, B, X, dll" />
          </div>
          <div>
            <label className="form-label">Title *</label>
            <input className="form-input" value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="Shift Pagi" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={fHoliday} onChange={e => setFHoliday(e.target.checked)} className="accent-blue-600" />
            <span className="text-sm text-gray-700">Hari Libur</span>
          </label>
          {!fHoliday && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Work In</label>
                  <input type="time" className="form-input" value={fIn} onChange={e => setFIn(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Work Out</label>
                  <input type="time" className="form-input" value={fOut} onChange={e => setFOut(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="form-label">Tolerance (minutes)</label>
                <input type="number" className="form-input" value={fTol} onChange={e => setFTol(e.target.value)} min={0} />
              </div>
            </>
          )}
        </div>
        <div className="flex gap-2 justify-end mt-5 pt-4 border-t border-gray-100">
          <button onClick={() => setCodeModalOpen(false)} className="btn-secondary">Batal</button>
          <button onClick={handleSaveCode} disabled={savingCode} className="btn-primary">
            {savingCode ? <Spinner className="w-4 h-4" /> : null} Simpan
          </button>
        </div>
      </Modal>

      {/* Upload Schedule Modal */}
      <Modal open={uploadModal} onClose={() => setUploadModal(false)} title="Upload Schedule" width="max-w-2xl">
        <div className="space-y-4">
          {/* Step 1: download template */}
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">1</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Download template jadwal minggu ini</p>
              <p className="text-xs text-gray-500 mt-0.5">Template sudah terisi karyawan aktif & jadwal yang sudah ada. Sheet "Info" berisi daftar kode shift yang valid.</p>
              <button onClick={handleDownloadTemplate} className="btn-secondary mt-2 text-xs">
                <Download size={13} /> Download Template ({weekStart} s/d {weekEnd})
              </button>
            </div>
          </div>

          {/* Step 2: upload */}
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-6 h-6 rounded-full bg-gray-400 text-white text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">2</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Upload file Excel yang sudah diisi</p>
              <p className="text-xs text-gray-500 mt-0.5">Format: .xlsx · Kolom A = Kode Karyawan, B = Nama, kolom berikutnya = tanggal (YYYY-MM-DD)</p>
              <div className="mt-2 flex items-center gap-3">
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
                <button onClick={() => fileInputRef.current?.click()} className="btn-secondary text-xs">
                  <Upload size={13} /> Pilih File
                </button>
                {uploadFile && <span className="text-xs text-gray-600 truncate max-w-[200px]">{uploadFile.name}</span>}
              </div>
            </div>
          </div>

          {/* Preview */}
          {uploadPreview.headers.length > 0 && !uploadResult && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Preview (5 baris pertama)</p>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      {uploadPreview.headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {uploadPreview.rows.map((row, i) => (
                      <tr key={i} className="border-t border-gray-50">
                        {row.map((cell, j) => (
                          <td key={j} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">
                            {j >= 2 && cell ? <span className="badge badge-blue text-[10px]">{cell}</span> : cell || <span className="text-gray-300">-</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Result */}
          {uploadResult && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl">
                <CheckCircle size={16} className="text-green-600 shrink-0" />
                <p className="text-sm text-green-700 font-medium">{uploadResult.success} jadwal berhasil diimport</p>
              </div>
              {uploadResult.skipped.length > 0 && (
                <div className="p-3 bg-yellow-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-1.5">
                    <AlertCircle size={14} className="text-yellow-600 shrink-0" />
                    <p className="text-xs font-semibold text-yellow-700">{uploadResult.skipped.length} item dilewati</p>
                  </div>
                  <ul className="space-y-0.5">
                    {uploadResult.skipped.map((s, i) => <li key={i} className="text-xs text-yellow-700">• {s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
            <button onClick={() => setUploadModal(false)} className="btn-secondary">Tutup</button>
            {uploadFile && !uploadResult && (
              <button onClick={handleImport} disabled={uploading} className="btn-primary">
                {uploading ? <Spinner className="w-4 h-4" /> : <Upload size={14} />}
                {uploading ? 'Mengimport...' : 'Import Sekarang'}
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* Assign Schedule Modal */}
      <Modal open={assignModal} onClose={() => setAssignModal(false)} title="Atur Jadwal Shift" width="max-w-sm">
        {assignEmp && (
          <div className="space-y-4">
            {assignError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{assignError}</div>
            )}
            <div className="p-3 bg-gray-50 rounded-xl text-sm">
              <p className="font-semibold text-gray-900">{assignEmp.full_name}</p>
              <p className="text-gray-500 text-xs mt-0.5">
                {new Date(assignDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div>
              <label className="form-label">Shift Code</label>
              <select className="form-input" value={assignShiftId} onChange={e => setAssignShiftId(e.target.value)}>
                <option value="">— Tidak ada shift —</option>
                {shiftCodes.map(sc => (
                  <option key={sc.id} value={sc.id}>
                    {sc.code} — {sc.title}{sc.is_holiday ? ' (Libur)' : sc.work_in ? ` (${sc.work_in}–${sc.work_out})` : ''}
                  </option>
                ))}
              </select>
              {!assignShiftId && (
                <p className="text-xs text-gray-400 mt-1">Memilih kosong akan menghapus jadwal pada hari ini</p>
              )}
            </div>
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <button onClick={() => setAssignModal(false)} className="btn-secondary flex-1 justify-center">Batal</button>
              <button onClick={handleSaveAssign} disabled={savingAssign} className="btn-primary flex-1 justify-center">
                {savingAssign ? <Spinner className="w-4 h-4" /> : null} Simpan
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Assign Modal */}
      <Modal open={bulkModal} onClose={() => setBulkModal(false)} title="Bulk Assign Shift" width="max-w-sm">
        {bulkEmp && (
          <div className="space-y-4">
            {bulkError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{bulkError}</div>
            )}
            <div className="p-3 bg-gray-50 rounded-xl text-sm">
              <p className="font-semibold text-gray-900">{bulkEmp.full_name}</p>
              <p className="text-gray-500 text-xs mt-0.5">{weekStart} s/d {weekEnd}</p>
            </div>
            <div>
              <label className="form-label">Shift Code</label>
              <select className="form-input" value={bulkShiftId} onChange={e => setBulkShiftId(e.target.value)}>
                <option value="">— Hapus jadwal hari terpilih —</option>
                {shiftCodes.map(sc => (
                  <option key={sc.id} value={sc.id}>
                    {sc.code} — {sc.title}{sc.is_holiday ? ' (Libur)' : sc.work_in ? ` (${sc.work_in}–${sc.work_out})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="form-label mb-0">Pilih Hari</label>
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => {
                    const allDates = weekDates.map(d => d.toISOString().split('T')[0])
                    setBulkDates(bulkDates.length === allDates.length ? [] : allDates)
                  }}
                >
                  {bulkDates.length === weekDates.length ? 'Batal Semua' : 'Pilih Semua'}
                </button>
              </div>
              <div className="space-y-1.5">
                {weekDates.map(d => {
                  const dateStr = d.toISOString().split('T')[0]
                  const checked = bulkDates.includes(dateStr)
                  const existing = getSchedule(bulkEmp.id, d)
                  return (
                    <label key={dateStr} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setBulkDates(prev =>
                          checked ? prev.filter(x => x !== dateStr) : [...prev, dateStr]
                        )}
                        className="accent-blue-600"
                      />
                      <span className="text-gray-700">
                        {DAYS_ID[d.getDay()]}, {d.getDate()} {d.toLocaleString('id-ID', { month: 'short' })}
                      </span>
                      {existing && (
                        <span className="badge badge-blue text-[10px]">{existing.shift_code?.code}</span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <button onClick={() => setBulkModal(false)} className="btn-secondary flex-1 justify-center">Batal</button>
              <button onClick={handleSaveBulk} disabled={savingBulk || bulkDates.length === 0} className="btn-primary flex-1 justify-center">
                {savingBulk ? <Spinner className="w-4 h-4" /> : null} Simpan
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteCode} onClose={() => { setDeleteCode(null); setDeleteCodeError('') }} title="Hapus Shift Code" width="max-w-sm">
        {deleteCodeError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">{deleteCodeError}</div>
        )}
        <p className="text-sm text-gray-600 mb-5">
          Yakin ingin menghapus shift code <strong>{deleteCode?.code} — {deleteCode?.title}</strong>?
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => { setDeleteCode(null); setDeleteCodeError('') }} className="btn-secondary">Batal</button>
          <button onClick={handleDeleteCode} className="btn-danger">Hapus</button>
        </div>
      </Modal>
    </div>
  )
}
