import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
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
}

const EVENT_CATEGORIES = [
  {
    value: "national_holiday",
    label: "National Holidays",
    color: "bg-red-500",
  },
  { value: "company_event", label: "Company Event", color: "bg-blue-500" },
  { value: "leave", label: "Leave", color: "bg-purple-500" },
  { value: "meeting", label: "Meeting", color: "bg-yellow-500" },
  { value: "other", label: "Other", color: "bg-gray-500" },
];

const NATIONAL_HOLIDAYS_2026 = [
  {
    title: "Tahun Baru 2026",
    start_date: "2026-01-01",
    end_date: "2026-01-01",
    type: "national_holiday",
  },
  {
    title: "Isra Mikraj",
    start_date: "2026-01-27",
    end_date: "2026-01-27",
    type: "national_holiday",
  },
  {
    title: "Tahun Baru Imlek",
    start_date: "2026-02-17",
    end_date: "2026-02-17",
    type: "national_holiday",
  },
  {
    title: "Hari Raya Nyepi",
    start_date: "2026-03-03",
    end_date: "2026-03-03",
    type: "national_holiday",
  },
  {
    title: "Idul Fitri",
    start_date: "2026-03-20",
    end_date: "2026-03-21",
    type: "national_holiday",
  },
  {
    title: "Cuti Bersama Idul Fitri",
    start_date: "2026-03-23",
    end_date: "2026-03-27",
    type: "national_holiday",
  },
  {
    title: "Jumat Agung",
    start_date: "2026-04-03",
    end_date: "2026-04-03",
    type: "national_holiday",
  },
  {
    title: "Hari Buruh",
    start_date: "2026-05-01",
    end_date: "2026-05-01",
    type: "national_holiday",
  },
  {
    title: "Kenaikan Isa Almasih",
    start_date: "2026-05-14",
    end_date: "2026-05-14",
    type: "national_holiday",
  },
  {
    title: "Hari Raya Waisak",
    start_date: "2026-05-24",
    end_date: "2026-05-24",
    type: "national_holiday",
  },
  {
    title: "Idul Adha",
    start_date: "2026-05-27",
    end_date: "2026-05-27",
    type: "national_holiday",
  },
  {
    title: "Hari Lahir Pancasila",
    start_date: "2026-06-01",
    end_date: "2026-06-01",
    type: "national_holiday",
  },
  {
    title: "Tahun Baru Islam 1448H",
    start_date: "2026-06-16",
    end_date: "2026-06-16",
    type: "national_holiday",
  },
  {
    title: "Hari Kemerdekaan RI",
    start_date: "2026-08-17",
    end_date: "2026-08-17",
    type: "national_holiday",
  },
  {
    title: "Maulid Nabi Muhammad SAW",
    start_date: "2026-09-24",
    end_date: "2026-09-24",
    type: "national_holiday",
  },
  {
    title: "Hari Natal",
    start_date: "2026-12-25",
    end_date: "2026-12-25",
    type: "national_holiday",
  },
];

const COLOR_MAP: Record<string, string> = {
  national_holiday: "bg-red-500",
  company_event: "bg-blue-500",
  leave: "bg-purple-500",
  meeting: "bg-yellow-500",
  other: "bg-gray-400",
};

const TEXT_MAP: Record<string, string> = {
  national_holiday: "text-red-600 bg-red-50",
  company_event: "text-blue-600 bg-blue-50",
  leave: "text-purple-600 bg-purple-50",
  meeting: "text-yellow-600 bg-yellow-50",
  other: "text-gray-600 bg-gray-50",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
const DAYS_HEADER = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export default function CalendarPage() {
  const { employee } = useAuth();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [fCategory, setFCategory] = useState("national_holiday");
  const [fTitle, setFTitle] = useState("");
  const [fEndDate, setFEndDate] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [formError, setFormError] = useState("");

  // Day detail panel
  const [detailDate, setDetailDate] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("calendar_events")
      .select("*")
      .order("start_date");
    setEvents((data || []) as CalendarEvent[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // All events = DB events + national holidays (deduplicated)
  const allEvents: (CalendarEvent & { is_national?: boolean })[] = [
    ...NATIONAL_HOLIDAYS_2026.map((h, i) => ({
      id: `national-${i}`,
      ...h,
      description: null,
      created_by: null,
      created_at: "",
      is_national: true,
    })),
    ...events,
  ];

  const getEventsForDate = (dateStr: string) =>
    allEvents.filter((e) => e.start_date <= dateStr && e.end_date >= dateStr);

  const handleDayClick = (dateStr: string) => {
    if (detailDate === dateStr) {
      setDetailDate(null);
    } else {
      setDetailDate(dateStr);
    }
  };

  const openAddModal = (dateStr?: string) => {
    setSelectedDate(
      dateStr ||
        `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
    );
    setFEndDate(dateStr || "");
    setFCategory("national_holiday");
    setFTitle("");
    setFDesc("");
    setFormError("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!fTitle.trim()) {
      setFormError("Nama event wajib diisi");
      return;
    }
    if (!selectedDate) {
      setFormError("Tanggal wajib diisi");
      return;
    }
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
      fetchEvents();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("calendar_events").delete().eq("id", id);
    fetchEvents();
    setDetailDate(null);
  };

  // Navigate months
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else setViewMonth((m) => m - 1);
    setDetailDate(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else setViewMonth((m) => m + 1);
    setDetailDate(null);
  };
  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setDetailDate(null);
  };

  // Build calendar grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDayOfWeek = getFirstDayOfMonth(viewYear, viewMonth);
  const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const detailEvents = detailDate ? getEventsForDate(detailDate) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Calendar</h1>
        <button onClick={() => openAddModal()} className="btn-primary">
          <Plus size={14} /> Add Event
        </button>
      </div>

      <div className="flex gap-4">
        {/* Calendar */}
        <div className="flex-1 card overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="btn-icon">
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={goToday}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Today
              </button>
              <button onClick={nextMonth} className="btn-icon">
                <ChevronRight size={16} />
              </button>
            </div>
            <h2 className="text-base font-semibold text-gray-900">
              {MONTHS_ID[viewMonth]} {viewYear}
            </h2>
            <div className="w-24" />
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAYS_HEADER.map((d) => (
              <div
                key={d}
                className={clsx(
                  "py-2 text-center text-xs font-semibold",
                  d === "Min" || d === "Sab" ? "text-red-400" : "text-gray-500",
                )}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          {loading ? (
            <div className="flex justify-center py-20">
              <Spinner />
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {Array.from({ length: totalCells }, (_, i) => {
                const dayNum = i - firstDayOfWeek + 1;
                const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
                const dateStr = isCurrentMonth
                  ? `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`
                  : "";
                const dayEvents = dateStr ? getEventsForDate(dateStr) : [];
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === detailDate;
                const isWeekend = i % 7 === 0 || i % 7 === 6;

                return (
                  <div
                    key={i}
                    onClick={() =>
                      isCurrentMonth && dateStr && handleDayClick(dateStr)
                    }
                    className={clsx(
                      "min-h-[90px] border-b border-r border-gray-50 p-1.5 transition-colors",
                      isCurrentMonth
                        ? "cursor-pointer hover:bg-gray-50"
                        : "bg-gray-50/30",
                      isSelected && "bg-blue-50/60",
                      !isCurrentMonth && "opacity-30",
                    )}
                  >
                    {isCurrentMonth && (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={clsx(
                              "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                              isToday
                                ? "bg-blue-600 text-white"
                                : isWeekend
                                  ? "text-red-400"
                                  : "text-gray-700",
                            )}
                          >
                            {dayNum}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {dayEvents.slice(0, 3).map((ev, j) => (
                            <div
                              key={j}
                              className={clsx(
                                "text-[10px] px-1.5 py-0.5 rounded font-medium truncate text-white",
                                COLOR_MAP[ev.type] || "bg-gray-400",
                              )}
                            >
                              {ev.title}
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-[10px] text-gray-400 px-1">
                              +{dayEvents.length - 3} more
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 px-5 py-3 border-t border-gray-100 flex-wrap">
            {EVENT_CATEGORIES.map((c) => (
              <div
                key={c.value}
                className="flex items-center gap-1.5 text-xs text-gray-600"
              >
                <div className={clsx("w-2.5 h-2.5 rounded-sm", c.color)} />
                {c.label}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel — day detail or upcoming */}
        <div className="w-72 shrink-0 space-y-4">
          {/* Day detail */}
          {detailDate ? (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-900">
                  {new Date(detailDate + "T00:00:00").toLocaleDateString(
                    "id-ID",
                    {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    },
                  )}
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
                <p className="text-xs text-gray-400 text-center py-4">
                  Tidak ada event
                </p>
              ) : (
                <div className="space-y-2">
                  {detailEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className={clsx(
                        "p-2.5 rounded-lg",
                        TEXT_MAP[ev.type] || "bg-gray-50 text-gray-700",
                      )}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-xs font-semibold leading-tight">
                          {ev.title}
                        </p>
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
                        {
                          EVENT_CATEGORIES.find((c) => c.value === ev.type)
                            ?.label
                        }
                      </p>
                      {ev.description && (
                        <p className="text-[10px] mt-1 opacity-70">
                          {ev.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {/* Upcoming events */}
          <div className="card p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">
              Mendatang
            </p>
            <div className="space-y-2">
              {[...allEvents]
                .filter((e) => e.end_date >= todayStr)
                .sort((a, b) => a.start_date.localeCompare(b.start_date))
                .slice(0, 8)
                .map((ev, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 py-1.5 border-b border-gray-50 last:border-0"
                  >
                    <div
                      className={clsx(
                        "w-2 h-2 rounded-full mt-1.5 shrink-0",
                        COLOR_MAP[ev.type] || "bg-gray-400",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {ev.title}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(
                          ev.start_date + "T00:00:00",
                        ).toLocaleDateString("id-ID", {
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

      {/* Add Event Modal — simple like Appsensi */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">
                Add Event
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="btn-icon text-gray-400"
              >
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
                <label className="form-label">Events Category *</label>
                <select
                  className="form-input"
                  value={fCategory}
                  onChange={(e) => setFCategory(e.target.value)}
                >
                  {EVENT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">End Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={fEndDate}
                  onChange={(e) => setFEndDate(e.target.value)}
                  placeholder="Sama dengan start date jika 1 hari"
                />
              </div>
              <div>
                <label className="form-label">Events Name *</label>
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
              <button
                onClick={() => setModalOpen(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? <Spinner className="w-4 h-4" /> : null} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
