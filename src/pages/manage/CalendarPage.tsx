import { useState, useEffect, useCallback, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DateClickArg } from '@fullcalendar/interaction'
import type { EventClickArg, EventInput } from '@fullcalendar/core'

import { Plus, Trash2 } from 'lucide-react'
import { Modal, Spinner } from '../../components/ui'
import clsx from 'clsx'

interface CalendarEvent {
  id: string
  title: string
  start_date: string
  end_date: string
  type: 'holiday' | 'event' | 'leave'
  color?: string
  description?: string
  is_national_holiday: boolean
}

// Indonesian national holidays 2026
const NATIONAL_HOLIDAYS_2026: Omit<CalendarEvent, 'id'>[] = [
  { title: 'Tahun Baru 2026',            start_date: '2026-01-01', end_date: '2026-01-01', type: 'holiday', is_national_holiday: true },
  { title: 'Isra Mikraj',                start_date: '2026-01-27', end_date: '2026-01-27', type: 'holiday', is_national_holiday: true },
  { title: 'Imlek',                      start_date: '2026-02-17', end_date: '2026-02-17', type: 'holiday', is_national_holiday: true },
  { title: 'Hari Raya Nyepi',            start_date: '2026-03-03', end_date: '2026-03-03', type: 'holiday', is_national_holiday: true },
  { title: 'Jumat Agung',                start_date: '2026-04-03', end_date: '2026-04-03', type: 'holiday', is_national_holiday: true },
  { title: 'Idul Fitri',                 start_date: '2026-03-20', end_date: '2026-03-21', type: 'holiday', is_national_holiday: true },
  { title: 'Cuti Bersama Idul Fitri',    start_date: '2026-03-23', end_date: '2026-03-27', type: 'holiday', is_national_holiday: true },
  { title: 'Hari Buruh',                 start_date: '2026-05-01', end_date: '2026-05-01', type: 'holiday', is_national_holiday: true },
  { title: 'Kenaikan Isa Almasih',       start_date: '2026-05-14', end_date: '2026-05-14', type: 'holiday', is_national_holiday: true },
  { title: 'Hari Raya Waisak',           start_date: '2026-05-24', end_date: '2026-05-24', type: 'holiday', is_national_holiday: true },
  { title: 'Idul Adha',                  start_date: '2026-05-27', end_date: '2026-05-27', type: 'holiday', is_national_holiday: true },
  { title: 'Hari Lahir Pancasila',       start_date: '2026-06-01', end_date: '2026-06-01', type: 'holiday', is_national_holiday: true },
  { title: 'Tahun Baru Islam 1448H',     start_date: '2026-06-16', end_date: '2026-06-16', type: 'holiday', is_national_holiday: true },
  { title: 'Hari Kemerdekaan RI',        start_date: '2026-08-17', end_date: '2026-08-17', type: 'holiday', is_national_holiday: true },
  { title: 'Maulid Nabi Muhammad SAW',   start_date: '2026-09-24', end_date: '2026-09-24', type: 'holiday', is_national_holiday: true },
  { title: 'Hari Natal',                 start_date: '2026-12-25', end_date: '2026-12-25', type: 'holiday', is_national_holiday: true },
]

const TYPE_COLORS: Record<string, string> = {
  holiday: '#ef4444',
  event:   '#3b82f6',
  leave:   '#a855f7',
}

export default function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null)
  const [events, setEvents]         = useState<CalendarEvent[]>([])
  const [loading, setLoading]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [modalOpen, setModalOpen]   = useState(false)
  const [_clickedDate, setClickedDate] = useState('')
  const [editTarget, setEditTarget] = useState<CalendarEvent | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null)
  const [formError, setFormError]   = useState('')

  // Form
  const [fTitle, setFTitle]         = useState('')
  const [fStart, setFStart]         = useState('')
  const [fEnd, setFEnd]             = useState('')
  const [fType, setFType]           = useState<'holiday' | 'event'>('event')
  const [fDesc, setFDesc]           = useState('')

  // Fetch custom events from DB
  const fetchEvents = useCallback(async () => {
    setLoading(true)
    // We store custom events in news_feeds repurposed, or better in a dedicated table
    // For now store in a simple format using audit_logs module = 'calendar'
    // In production you'd create a calendar_events table
    // Here we just use local state + national holidays
    setLoading(false)
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  // Build FullCalendar events
  const fcEvents: EventInput[] = [
    // National holidays
    ...NATIONAL_HOLIDAYS_2026.map((h, i) => ({
      id: `national-${i}`,
      title: h.title,
      start: h.start_date,
      end: h.end_date,
      color: TYPE_COLORS.holiday,
      extendedProps: { type: 'holiday', is_national: true },
    })),
    // Custom events
    ...events.map(e => ({
      id: e.id,
      title: e.title,
      start: e.start_date,
      end: e.end_date,
      color: TYPE_COLORS[e.type] || TYPE_COLORS.event,
      extendedProps: { type: e.type, description: e.description },
    })),
  ]

  const handleDateClick = (arg: DateClickArg) => {
    setClickedDate(arg.dateStr)
    setEditTarget(null)
    setFTitle(''); setFStart(arg.dateStr); setFEnd(arg.dateStr)
    setFType('event'); setFDesc('')
    setFormError('')
    setModalOpen(true)
  }

  const handleEventClick = (arg: EventClickArg) => {
    const isNational = arg.event.extendedProps.is_national
    if (isNational) return // Can't edit national holidays

    const custom = events.find(e => e.id === arg.event.id)
    if (!custom) return

    setEditTarget(custom)
    setFTitle(custom.title)
    setFStart(custom.start_date)
    setFEnd(custom.end_date)
    setFType(custom.type as 'holiday' | 'event')
    setFDesc(custom.description || '')
    setFormError('')
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!fTitle.trim()) { setFormError('Judul wajib diisi'); return }
    if (!fStart) { setFormError('Tanggal mulai wajib diisi'); return }
    setFormError('')
    setSaving(true)

    const newEvent: CalendarEvent = {
      id: editTarget?.id || `custom-${Date.now()}`,
      title: fTitle,
      start_date: fStart,
      end_date: fEnd || fStart,
      type: fType,
      description: fDesc,
      is_national_holiday: false,
    }

    if (editTarget) {
      setEvents(prev => prev.map(e => e.id === editTarget.id ? newEvent : e))
    } else {
      setEvents(prev => [...prev, newEvent])
    }

    setSaving(false)
    setModalOpen(false)
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    setEvents(prev => prev.filter(e => e.id !== deleteTarget.id))
    setDeleteTarget(null)
    setModalOpen(false)
  }

  // Legend
  const legend = [
    { color: TYPE_COLORS.holiday, label: 'Hari Libur Nasional' },
    { color: TYPE_COLORS.event,   label: 'Event Perusahaan' },
    { color: TYPE_COLORS.leave,   label: 'Cuti Karyawan' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Calendar</h1>
        <button onClick={() => {
          const today = new Date().toISOString().split('T')[0]
          setClickedDate(today)
          setEditTarget(null)
          setFTitle(''); setFStart(today); setFEnd(today)
          setFType('event'); setFDesc('')
          setFormError('')
          setModalOpen(true)
        }} className="btn-primary">
          <Plus size={14} /> Add Event
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {legend.map(l => (
          <div key={l.label} className="flex items-center gap-1.5 text-xs text-gray-600">
            <div className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="card p-4">
        <style>{`
          .fc { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; }
          .fc-toolbar-title { font-size: 16px !important; font-weight: 600 !important; }
          .fc-button { font-size: 12px !important; padding: 4px 10px !important; border-radius: 6px !important; }
          .fc-button-primary { background: #2563eb !important; border-color: #2563eb !important; }
          .fc-button-primary:hover { background: #1d4ed8 !important; }
          .fc-button-primary:not(.fc-button-active):not(:disabled) { background: #2563eb !important; }
          .fc-today-button { background: white !important; color: #374151 !important; border-color: #d1d5db !important; }
          .fc-today-button:hover { background: #f9fafb !important; }
          .fc-daygrid-day:hover { background: #eff6ff; cursor: pointer; }
          .fc-daygrid-day.fc-day-today { background: #eff6ff !important; }
          .fc-daygrid-day.fc-day-today .fc-daygrid-day-number { background: #2563eb; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }
          .fc-event { border-radius: 4px !important; font-size: 11px !important; padding: 1px 4px !important; cursor: pointer; }
          .fc-day-sat .fc-daygrid-day-number, .fc-day-sun .fc-daygrid-day-number { color: #ef4444; }
          .fc-col-header-cell-cushion { font-size: 12px; font-weight: 600; color: #6b7280; text-decoration: none !important; }
          .fc-daygrid-day-number { text-decoration: none !important; color: #374151; font-size: 12px; }
          .fc-scrollgrid { border-color: #f3f4f6 !important; }
          .fc-scrollgrid td, .fc-scrollgrid th { border-color: #f3f4f6 !important; }
        `}</style>
        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : (
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale="id"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth',
            }}
            buttonText={{ today: 'Today', month: 'Month' }}
            events={fcEvents}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            height="auto"
            dayMaxEvents={3}
            weekends={true}
            firstDay={1}
          />
        )}
      </div>

      {/* Upcoming events */}
      <div className="card p-4 mt-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Hari Libur Mendatang</h3>
        <div className="space-y-2">
          {NATIONAL_HOLIDAYS_2026
            .filter(h => new Date(h.start_date) >= new Date())
            .slice(0, 5)
            .map((h, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{h.title}</p>
                </div>
                <p className="text-xs text-gray-500 whitespace-nowrap">
                  {new Date(h.start_date).toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'short', year: 'numeric'
                  })}
                </p>
              </div>
            ))}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editTarget ? 'Edit Event' : 'Tambah Event'} width="max-w-md">
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>
          )}
          <div>
            <label className="form-label">Judul *</label>
            <input className="form-input" value={fTitle}
              onChange={e => setFTitle(e.target.value)} placeholder="Nama event..." />
          </div>
          <div>
            <label className="form-label">Tipe</label>
            <div className="flex gap-2">
              {(['event', 'holiday'] as const).map(t => (
                <button key={t} onClick={() => setFType(t)}
                  className={clsx(
                    'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                    fType === t
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  )}>
                  <span className="inline-block w-2 h-2 rounded-full mr-1.5"
                    style={{ background: TYPE_COLORS[t] }} />
                  {t === 'event' ? 'Event Perusahaan' : 'Hari Libur'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Tanggal Mulai *</label>
              <input type="date" className="form-input" value={fStart}
                onChange={e => setFStart(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Tanggal Selesai</label>
              <input type="date" className="form-input" value={fEnd}
                onChange={e => setFEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="form-label">Deskripsi</label>
            <textarea className="form-input" rows={3} value={fDesc}
              onChange={e => setFDesc(e.target.value)} placeholder="Keterangan tambahan..." />
          </div>
        </div>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
          <div>
            {editTarget && (
              <button onClick={() => setDeleteTarget(editTarget)}
                className="btn-danger text-xs py-1.5 px-3">
                <Trash2 size={13} /> Hapus
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Batal</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Spinner className="w-4 h-4" /> : null} Simpan
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        title="Hapus Event" width="max-w-sm">
        <p className="text-sm text-gray-600 mb-5">
          Yakin ingin menghapus event <strong>{deleteTarget?.title}</strong>?
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Batal</button>
          <button onClick={handleDelete} className="btn-danger">Hapus</button>
        </div>
      </Modal>
    </div>
  )
}
