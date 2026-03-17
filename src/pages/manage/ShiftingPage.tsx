import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Edit2, Trash2, ChevronLeft, ChevronRight, Upload } from 'lucide-react'
import { Spinner, Modal } from '../../components/ui'
import type { ShiftCode, Employee, Group, Schedule } from '../../types'
import clsx from 'clsx'

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

  const [savingCode, setSavingCode]       = useState(false)
  const [codeModalOpen, setCodeModalOpen] = useState(false)
  const [editCode, setEditCode]           = useState<ShiftCode | null>(null)
  const [deleteCode, setDeleteCode]       = useState<ShiftCode | null>(null)
  const [codeError, setCodeError]         = useState('')
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
    const { data } = await supabase
      .from('schedules')
      .select('*, shift_code:shift_codes(id,code,title,is_holiday)')
      .gte('schedule_date', weekStart)
      .lte('schedule_date', weekEnd)
    setSchedules((data as Schedule[]) || [])
    setLoadingSched(false)
  }, [weekStart, weekEnd])

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
    await supabase.from('shift_codes').delete().eq('id', deleteCode.id)
    setDeleteCode(null)
    const { data } = await supabase.from('shift_codes').select('*').order('code')
    setShiftCodes((data as ShiftCode[]) || [])
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
              <button className="btn-secondary ml-auto"><Upload size={14} /> Upload Schedule</button>
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
                          <td className="px-4 py-3 font-medium text-gray-900">{emp.full_name}</td>
                          {weekDates.map((d, i) => {
                            const sched = getSchedule(emp.id, d)
                            return (
                              <td key={i} className="px-3 py-3 text-center">
                                {sched ? (
                                  <span className={clsx('badge text-xs', sched.shift_code?.is_holiday ? 'badge-red' : 'badge-blue')}>
                                    {sched.shift_code?.code || '-'}
                                  </span>
                                ) : (
                                  <span className="text-gray-200">-</span>
                                )}
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

      {/* Delete confirm */}
      <Modal open={!!deleteCode} onClose={() => setDeleteCode(null)} title="Hapus Shift Code" width="max-w-sm">
        <p className="text-sm text-gray-600 mb-5">
          Yakin ingin menghapus shift code <strong>{deleteCode?.code} — {deleteCode?.title}</strong>?
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setDeleteCode(null)} className="btn-secondary">Batal</button>
          <button onClick={handleDeleteCode} className="btn-danger">Hapus</button>
        </div>
      </Modal>
    </div>
  )
}
