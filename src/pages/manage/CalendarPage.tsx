import { useState, useEffect, useCallback, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateClickArg } from "@fullcalendar/interaction";
import type { EventClickArg, DatesSetArg, EventInput } from "@fullcalendar/core";
import { supabase } from "../../lib/supabase";
import { Plus, Trash2, X } from "lucide-react";
import { Spinner } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import clsx from "clsx";

interface CalendarEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  type: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  is_national?: boolean;
}

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
}

const EVENT_CATEGORIES = [
  { value: "national_holiday", label: "National Holidays", color: "#ef4444" },
  { value: "company_event", label: "Company Event", color: "#3b82f6" },
  { value: "leave", label: "Leave", color: "#a855f7" },
  { value: "meeting", label: "Meeting", color: "#f59e0b" },
  { value: "other", label: "Other", color: "#9ca3af" },
];

const COLOR_MAP: Record<string, string> = {
  national_holiday: "#ef4444",
  company_event: "#3b82f6",
  leave: "#a855f7",
  meeting: "#f59e0b",
  other: "#9ca3af",
};

const TEXT_MAP: Record<string, string> = {
  national_holiday: "text-red-600 bg-red-50",
  company_event: "text-blue-600 bg-blue-50",
  leave: "text-purple-600 bg-purple-50",
  meeting: "text-yellow-600 bg-yellow-50",
  other: "text-gray-600 bg-gray-50",
};

export default function CalendarPage() {
  const { employee } = useAuth();
  const calendarRef = useRef<FullCalendar>(null);
  const holidayCache = useRef<Record<number, CalendarEvent[]>>({});

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [dbEvents, setDbEvents] = useState<CalendarEvent[]>([]);
  const [nationalHolidays, setNationalHolidays] = useState<CalendarEvent[]>([]);
  const [holidayLoading, setHolidayLoading] = useState(false);
  const [holidayError, setHolidayError] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [fCategory, setFCategory] = useState("company_event");
  const [fTitle, setFTitle] = useState("");
  const [fEndDate, setFEndDate] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [formError, setFormError] = useState("");

  // Day detail panel
  const [detailDate, setDetailDate] = useState<string | null>(null);

  const fetchDbEvents = useCallback(async () => {
    const { data } = await supabase
      .from("calendar_events")
      .select("*")
      .order("start_date");
    setDbEvents((data || []) as CalendarEvent[]);
  }, []);

  const fetchNationalHolidays = useCallback(async (year: number) => {
    if (holidayCache.current[year]) {
      setNationalHolidays(holidayCache.current[year]);
      setHolidayError('');
      return;
    }
    setHolidayLoading(true);
    setHolidayError('');
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY;
      if (!apiKey) throw new Error("VITE_GOOGLE_CALENDAR_API_KEY belum diset di environment variables");

      const calendarId =
        "en.indonesian%23holiday%40group.v.calendar.google.com";
      const timeMin = `${year}-01-01T00:00:00Z`;
      const timeMax = `${year + 1}-01-01T00:00:00Z`;

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=50`,
      );
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      const data: GoogleCalendarEvent[] = json.items || [];

      const mapped: CalendarEvent[] = data.map((h) => {
        const startDate =
          h.start.date || h.start.dateTime?.split("T")[0] || "";
        const endRaw =
          h.end.date || h.end.dateTime?.split("T")[0] || startDate;
        const endDate = h.end.date
          ? new Date(new Date(endRaw).getTime() - 86400000)
              .toISOString()
              .split("T")[0]
          : endRaw;
        return {
          id: `national-${h.id}`,
          title: h.summary,
          start_date: startDate,
          end_date: endDate,
          type: "national_holiday",
          description: null,
          created_by: null,
          created_at: "",
          is_national: true,
        };
      });

      holidayCache.current[year] = mapped;
      setNationalHolidays(mapped);
    } catch (err: any) {
      setNationalHolidays(holidayCache.current[year] || []);
      setHolidayError(err.message || 'Gagal memuat hari libur nasional');
    } finally {
      setHolidayLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDbEvents();
  }, [fetchDbEvents]);

  useEffect(() => {
    fetchNationalHolidays(viewYear);
  }, [viewYear, fetchNationalHolidays]);

  const allEvents: CalendarEvent[] = [...nationalHolidays, ...dbEvents];

  // Convert to FullCalendar event format
  const fcEvents: EventInput[] = allEvents.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start_date,
    // FullCalendar end for all-day is exclusive, add 1 day
    end: e.end_date
      ? new Date(new Date(e.end_date).getTime() + 86400000)
          .toISOString()
          .split("T")[0]
      : undefined,
    backgroundColor: COLOR_MAP[e.type] || "#9ca3af",
    borderColor: COLOR_MAP[e.type] || "#9ca3af",
    extendedProps: { type: e.type, is_national: e.is_national, description: e.description },
  }));

  const getEventsForDate = (dateStr: string) =>
    allEvents.filter((e) => e.start_date <= dateStr && e.end_date >= dateStr);

  const handleDateClick = (arg: DateClickArg) => {
    setDetailDate(arg.dateStr === detailDate ? null : arg.dateStr);
  };

  const handleEventClick = (arg: EventClickArg) => {
    setDetailDate(arg.event.startStr.split("T")[0]);
  };

  const handleDatesSet = (arg: DatesSetArg) => {
    const mid = new Date((arg.start.getTime() + arg.end.getTime()) / 2);
    setViewYear(mid.getFullYear());
  };

  const openAddModal = (dateStr?: string) => {
    setSelectedDate(dateStr || todayStr);
    setFEndDate(dateStr || "");
    setFCategory("company_event");
    setFTitle("");
    setFDesc("");
    setFormError("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!fTitle.trim()) { setFormError("Nama event wajib diisi"); return; }
    if (!selectedDate) { setFormError("Tanggal wajib diisi"); return; }
    setFormError("");
    setSaving(true);

    const { error } = await supabase.from("calendar_events").insert({
      title: fTitle,
      start_date: selectedDate,
      end_date: fEndDate || selectedDate,
      type: fCategory,
      description: fDesc || null,
      created_by: employee?.id || null,
    });

    if (error) {
      setFormError(error.message);
    } else {
      setModalOpen(false);
      fetchDbEvents();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("calendar_events").delete().eq("id", id);
    fetchDbEvents();
    setDetailDate(null);
  };

  const detailEvents = detailDate ? getEventsForDate(detailDate) : [];
  const upcomingEvents = [...allEvents]
    .filter((e) => e.end_date >= todayStr)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 8);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Calendar</h1>
        <button onClick={() => openAddModal()} className="btn-primary">
          <Plus size={14} /> Add Event
        </button>
      </div>

      <div className="flex gap-4 items-start">
        {/* FullCalendar */}
        <div className="flex-1 card overflow-hidden fc-wrapper">
          {holidayLoading && (
            <div className="flex items-center gap-2 px-5 py-2 text-xs text-gray-400 border-b border-gray-100">
              <Spinner className="w-3 h-3" /> Memuat hari libur nasional...
            </div>
          )}
          {!holidayLoading && holidayError && (
            <div className="flex items-center gap-2 px-5 py-2 text-xs text-red-500 border-b border-red-100 bg-red-50">
              <span className="font-semibold">Hari libur nasional gagal dimuat:</span> {holidayError}
              <button onClick={() => { holidayCache.current[viewYear] = undefined as any; fetchNationalHolidays(viewYear); }}
                className="ml-2 underline text-red-600">Coba lagi</button>
            </div>
          )}
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale="id"
            events={fcEvents}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            datesSet={handleDatesSet}
            headerToolbar={{
              left: "prev,today,next",
              center: "title",
              right: "",
            }}
            buttonText={{ today: "Hari ini" }}
            height="auto"
            aspectRatio={1.8}
            dayMaxEvents={4}
            eventDisplay="block"
            displayEventTime={false}
            fixedWeekCount={false}
          />
          {/* Legend */}
          <div className="flex items-center gap-4 px-5 py-3 border-t border-gray-100 flex-wrap">
            {EVENT_CATEGORIES.map((c) => (
              <div key={c.value} className="flex items-center gap-1.5 text-xs text-gray-600">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c.color }} />
                {c.label}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-72 shrink-0 space-y-4">
          {/* Day detail */}
          {detailDate && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-900">
                  {new Date(detailDate + "T00:00:00").toLocaleDateString("id-ID", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openAddModal(detailDate)}
                    className="btn-icon text-blue-500 w-7 h-7"
                    title="Tambah event"
                  >
                    <Plus size={13} />
                  </button>
                  <button
                    onClick={() => setDetailDate(null)}
                    className="btn-icon text-gray-400 w-7 h-7"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
              {detailEvents.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Tidak ada event</p>
              ) : (
                <div className="space-y-2">
                  {detailEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className={clsx("p-2.5 rounded-lg", TEXT_MAP[ev.type] || "bg-gray-50 text-gray-700")}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-xs font-semibold leading-tight">{ev.title}</p>
                        {!ev.is_national && (
                          <button
                            onClick={() => handleDelete(ev.id)}
                            className="text-gray-400 hover:text-red-500 shrink-0 mt-0.5"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] mt-0.5 opacity-75">
                        {EVENT_CATEGORIES.find((c) => c.value === ev.type)?.label}
                      </p>
                      {ev.description && (
                        <p className="text-[10px] mt-1 opacity-70">{ev.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Upcoming events */}
          <div className="card p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Mendatang</p>
            <div className="space-y-2">
              {upcomingEvents.map((ev, i) => (
                <div key={i} className="flex items-start gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: COLOR_MAP[ev.type] || "#9ca3af" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{ev.title}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(ev.start_date + "T00:00:00").toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Add Event</h3>
              <button onClick={() => setModalOpen(false)} className="btn-icon text-gray-400">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {formError}
                </div>
              )}
              <div>
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">End Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={fEndDate}
                  onChange={(e) => setFEndDate(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Category *</label>
                <select
                  className="form-input"
                  value={fCategory}
                  onChange={(e) => setFCategory(e.target.value)}
                >
                  {EVENT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Event Name *</label>
                <input
                  className="form-input"
                  value={fTitle}
                  onChange={(e) => setFTitle(e.target.value)}
                  placeholder="Nama event..."
                />
              </div>
              <div>
                <label className="form-label">Description</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={fDesc}
                  onChange={(e) => setFDesc(e.target.value)}
                  placeholder="Keterangan (opsional)..."
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end px-6 pb-6">
              <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? <Spinner className="w-4 h-4" /> : null} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
