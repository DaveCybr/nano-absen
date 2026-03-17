import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { Plus, Download, Edit2, UserCheck, Search } from "lucide-react";
import { Spinner, EmptyState, Pagination, Modal } from "../../components/ui";
import type {
  Employee,
  Group,
  Position,
  Grade,
  EmploymentStatus,
} from "../../types";
import clsx from "clsx";

interface EmployeeWithRelations extends Omit<Employee, "group" | "position"> {
  group: Group | null;
  position: Position | null;
  grade: Grade | null;
  employment_status: EmploymentStatus | null;
}

const EMPTY_FORM = {
  employee_code: "",
  full_name: "",
  email: "",
  phone: "",
  ktp_number: "",
  npwp: "",
  date_of_birth: "",
  place_of_birth: "",
  gender: "",
  religion: "",
  marital_status: "",
  citizenship: "Indonesia",
  group_id: "",
  position_id: "",
  grade_id: "",
  employment_status_id: "",
  work_location: "",
  access_type: "staff",
  working_status: "active",
  join_date: "",
  resignation_date: "",
  is_active: true,
};

export default function EmployeePage() {
  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [empStatuses, setEmpStatuses] = useState<EmploymentStatus[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [accessFilter, setAccessFilter] = useState("all");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeWithRelations | null>(
    null,
  );
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });
  const [formError, setFormError] = useState("");

  // Load master data
  useEffect(() => {
    supabase
      .from("groups")
      .select("id,name")
      .order("name")
      .then(({ data }) => setGroups((data as Group[]) || []));
    supabase
      .from("positions")
      .select("id,code,name")
      .order("name")
      .then(({ data }) => setPositions((data as Position[]) || []));
    supabase
      .from("grades")
      .select("id,code,name")
      .order("name")
      .then(({ data }) => setGrades((data as Grade[]) || []));
    supabase
      .from("employment_statuses")
      .select("id,name_id,name_en")
      .order("name_id")
      .then(({ data }) => setEmpStatuses((data as EmploymentStatus[]) || []));
  }, []);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("employees")
        .select(
          `
          *,
          group:groups(id,name),
          position:positions(id,code,name),
          grade:grades(id,code,name),
          employment_status:employment_statuses(id,name_id,name_en)
        `,
          { count: "exact" },
        )
        .order("full_name");

      if (groupFilter !== "all") query = query.eq("group_id", groupFilter);
      if (statusFilter !== "all")
        query = query.eq("working_status", statusFilter);
      if (accessFilter !== "all") query = query.eq("access_type", accessFilter);
      if (search) query = query.ilike("full_name", `%${search}%`);

      const { data, count, error } = await query.range(
        (page - 1) * pageSize,
        page * pageSize - 1,
      );

      if (error) throw error;
      setEmployees((data as EmployeeWithRelations[]) || []);
      setTotal(count || 0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, groupFilter, statusFilter, accessFilter]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM });
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (emp: EmployeeWithRelations) => {
    setEditTarget(emp);
    setForm({
      employee_code: emp.employee_code,
      full_name: emp.full_name,
      email: emp.email,
      phone: emp.phone || "",
      ktp_number: emp.ktp_number || "",
      npwp: emp.npwp || "",
      date_of_birth: emp.date_of_birth || "",
      place_of_birth: emp.place_of_birth || "",
      gender: emp.gender || "",
      religion: emp.religion || "",
      marital_status: emp.marital_status || "",
      citizenship: emp.citizenship || "Indonesia",
      group_id: emp.group_id || "",
      position_id: emp.position_id || "",
      grade_id: emp.grade_id || "",
      employment_status_id: emp.employment_status_id || "",
      work_location: emp.work_location || "",
      access_type: emp.access_type,
      working_status: emp.working_status,
      join_date: emp.join_date || "",
      resignation_date: emp.resignation_date || "",
      is_active: emp.is_active,
    });
    setFormError("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      setFormError("Nama lengkap wajib diisi");
      return;
    }
    if (!form.email.trim()) {
      setFormError("Email wajib diisi");
      return;
    }
    if (!form.employee_code.trim()) {
      setFormError("ID karyawan wajib diisi");
      return;
    }
    setFormError("");
    setSaving(true);

    const payload = {
      employee_code: form.employee_code,
      full_name: form.full_name,
      email: form.email,
      phone: form.phone || null,
      ktp_number: form.ktp_number || null,
      npwp: form.npwp || null,
      date_of_birth: form.date_of_birth || null,
      place_of_birth: form.place_of_birth || null,
      gender: form.gender || null,
      religion: form.religion || null,
      marital_status: form.marital_status || null,
      citizenship: form.citizenship || "Indonesia",
      group_id: form.group_id || null,
      position_id: form.position_id || null,
      grade_id: form.grade_id || null,
      employment_status_id: form.employment_status_id || null,
      work_location: form.work_location || null,
      access_type: form.access_type,
      working_status: form.working_status,
      join_date: form.join_date || null,
      resignation_date: form.resignation_date || null,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editTarget) {
        const { error } = await supabase
          .from("employees")
          .update(payload)
          .eq("id", editTarget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employees").insert(payload);
        if (error) throw error;
      }
      setModalOpen(false);
      fetchEmployees();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (emp: EmployeeWithRelations) => {
    setTogglingId(emp.id);
    // Optimistic update
    setEmployees((prev) =>
      prev.map((e) => (e.id === emp.id ? { ...e, is_active: !emp.is_active } : e))
    );
    const { error } = await supabase
      .from("employees")
      .update({ is_active: !emp.is_active })
      .eq("id", emp.id);
    if (error) {
      // Revert on error
      setEmployees((prev) =>
        prev.map((e) => (e.id === emp.id ? { ...e, is_active: emp.is_active } : e))
      );
    }
    setTogglingId(null);
  };

  const setField = (key: string, val: any) =>
    setForm((p) => ({ ...p, [key]: val }));

  // Stats
  const activeCount = employees.filter((e) => e.is_active).length;
  const registeredCount = total;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Employee</h1>
        <div className="flex items-center gap-2">
          <button className="btn-secondary">
            <Download size={14} /> Download Report
          </button>
          <button onClick={openAdd} className="btn-primary">
            <Plus size={14} /> Add User
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
        <span>
          Active User: <strong className="text-green-600">{activeCount}</strong>
          /{registeredCount}
        </span>
        <span>
          Registered User: <strong>{registeredCount}</strong>
        </span>
      </div>

      {/* Table card */}
      <div className="card">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 p-4 border-b border-gray-100">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              className="form-input pl-8 w-52"
              placeholder="Cari karyawan..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="form-label">Access Type</label>
            <select
              className="form-input w-40"
              value={accessFilter}
              onChange={(e) => {
                setAccessFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Access Type</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="hr">HR</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <div>
            <label className="form-label">Search Group</label>
            <select
              className="form-input w-40"
              value={groupFilter}
              onChange={(e) => {
                setGroupFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">User Status</label>
            <select
              className="form-input w-36"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="resigned">Resigned</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Full Name</th>
                <th>Email</th>
                <th>Position</th>
                <th>Position Title</th>
                <th>Access Type</th>
                <th>Activation & Work Duration</th>
                <th>Active</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-16">
                    <Spinner className="mx-auto" />
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <EmptyState message="Tidak ada karyawan" />
              ) : (
                employees.map((emp) => (
                  <tr
                    key={emp.id}
                    className="hover:bg-gray-50/60 transition-colors"
                  >
                    <td className="font-mono text-xs text-gray-600">
                      {emp.employee_code}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                          {emp.full_name.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-900">
                          {emp.full_name}
                        </span>
                      </div>
                    </td>
                    <td className="text-gray-600 text-xs">{emp.email}</td>
                    <td>
                      {emp.group ? (
                        <span className="badge badge-gray">
                          {emp.group.name}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="text-gray-600">
                      {emp.position?.name || "-"}
                    </td>
                    <td>
                      <span
                        className={clsx("badge", {
                          "badge-purple": emp.access_type === "super_admin",
                          "badge-blue":
                            emp.access_type === "admin" ||
                            emp.access_type === "hr",
                          "badge-gray": emp.access_type === "staff",
                        })}
                      >
                        {emp.access_type === "super_admin"
                          ? "Super Admin"
                          : emp.access_type === "hr"
                            ? "HR"
                            : emp.access_type.charAt(0).toUpperCase() +
                              emp.access_type.slice(1)}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <UserCheck size={13} className="text-green-500" />
                        <span className="text-xs text-gray-500">
                          {emp.join_date
                            ? (() => {
                                const days = Math.floor(
                                  (Date.now() -
                                    new Date(emp.join_date).getTime()) /
                                    86400000,
                                );
                                const months = Math.floor(days / 30);
                                // const remDays = days % 30
                                return `${Math.floor(months / 12)} Months ${months % 12} Days`;
                              })()
                            : "-"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <button
                        onClick={() => toggleActive(emp)}
                        disabled={togglingId === emp.id}
                        className={clsx(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
                          emp.is_active
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        )}
                      >
                        <span className={clsx(
                          "w-1.5 h-1.5 rounded-full",
                          emp.is_active ? "bg-green-500" : "bg-gray-400"
                        )} />
                        {emp.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(emp)}
                          className="btn-icon text-blue-500"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPage={setPage}
          onPageSize={setPageSize}
        />
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? `Edit: ${editTarget.full_name}` : "Tambah Karyawan"}
        width="max-w-3xl"
      >
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {formError}
            </div>
          )}

          {/* Personal */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              — Personal —
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="form-label">Nama Lengkap *</label>
                <input
                  className="form-input"
                  value={form.full_name}
                  onChange={(e) => setField("full_name", e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Email *</label>
                <input
                  className="form-input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">No. Telepon</label>
                <input
                  className="form-input"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">KTP</label>
                <input
                  className="form-input"
                  value={form.ktp_number}
                  onChange={(e) => setField("ktp_number", e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">NPWP</label>
                <input
                  className="form-input"
                  value={form.npwp}
                  onChange={(e) => setField("npwp", e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Tempat Lahir</label>
                <input
                  className="form-input"
                  value={form.place_of_birth}
                  onChange={(e) => setField("place_of_birth", e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Tanggal Lahir</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => setField("date_of_birth", e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Gender</label>
                <select
                  className="form-input"
                  value={form.gender}
                  onChange={(e) => setField("gender", e.target.value)}
                >
                  <option value="">Pilih</option>
                  <option value="male">Laki-laki</option>
                  <option value="female">Perempuan</option>
                </select>
              </div>
              <div>
                <label className="form-label">Agama</label>
                <select
                  className="form-input"
                  value={form.religion}
                  onChange={(e) => setField("religion", e.target.value)}
                >
                  <option value="">Pilih</option>
                  {[
                    "islam",
                    "kristen",
                    "katolik",
                    "hindu",
                    "buddha",
                    "konghucu",
                    "other",
                  ].map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Status Pernikahan</label>
                <select
                  className="form-input"
                  value={form.marital_status}
                  onChange={(e) => setField("marital_status", e.target.value)}
                >
                  <option value="">Pilih</option>
                  <option value="single">Single</option>
                  <option value="married">Menikah</option>
                  <option value="divorced">Cerai</option>
                  <option value="widowed">Duda/Janda</option>
                </select>
              </div>
            </div>
          </div>

          {/* Work */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              — Work —
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">ID Karyawan *</label>
                <input
                  className="form-input"
                  value={form.employee_code}
                  onChange={(e) => setField("employee_code", e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Group</label>
                <select
                  className="form-input"
                  value={form.group_id}
                  onChange={(e) => setField("group_id", e.target.value)}
                >
                  <option value="">Pilih Group</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Position</label>
                <select
                  className="form-input"
                  value={form.position_id}
                  onChange={(e) => setField("position_id", e.target.value)}
                >
                  <option value="">Pilih Posisi</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Grade</label>
                <select
                  className="form-input"
                  value={form.grade_id}
                  onChange={(e) => setField("grade_id", e.target.value)}
                >
                  <option value="">Pilih Grade</option>
                  {grades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Status Kepegawaian</label>
                <select
                  className="form-input"
                  value={form.employment_status_id}
                  onChange={(e) =>
                    setField("employment_status_id", e.target.value)
                  }
                >
                  <option value="">Pilih Status</option>
                  {empStatuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name_id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Work Location</label>
                <input
                  className="form-input"
                  value={form.work_location}
                  onChange={(e) => setField("work_location", e.target.value)}
                  placeholder="Kantor Pusat"
                />
              </div>
              <div>
                <label className="form-label">Join Date</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.join_date}
                  onChange={(e) => setField("join_date", e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Working Status</label>
                <select
                  className="form-input"
                  value={form.working_status}
                  onChange={(e) => setField("working_status", e.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="resigned">Resigned</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>
            </div>
          </div>

          {/* Others */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              — Others —
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Resignation Date</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.resignation_date}
                  onChange={(e) => setField("resignation_date", e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Access Type *</label>
                <select
                  className="form-input"
                  value={form.access_type}
                  onChange={(e) => setField("access_type", e.target.value)}
                >
                  <option value="staff">Staff</option>
                  <option value="hr">HR</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Staff hanya bisa akses mobile app
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end mt-5 pt-4 border-t border-gray-100">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? (
              <>
                <Spinner className="w-4 h-4" /> Menyimpan...
              </>
            ) : (
              "Simpan"
            )}
          </button>
        </div>
      </Modal>
    </div>
  );
}
