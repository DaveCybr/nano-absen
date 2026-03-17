import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { Spinner, Modal } from "../../components/ui";

type Tab = "overtime" | "claim";

interface Category {
  id: string;
  code: string;
  name_id: string;
  name_en: string;
}

export default function CategoryPage() {
  const [tab, setTab] = useState<Tab>("overtime");
  const [overtime, setOvertime] = useState<Category[]>([]);
  const [claim, setClaim] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [formError, setFormError] = useState("");
  const [fCode, setFCode] = useState("");
  const [fNameId, setFNameId] = useState("");
  const [fNameEn, setFNameEn] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [o, c] = await Promise.all([
      supabase.from("overtime_categories").select("*").order("code"),
      supabase.from("claim_categories").select("*").order("code"),
    ]);
    setOvertime((o.data || []) as Category[]);
    setClaim((c.data || []) as Category[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const table = tab === "overtime" ? "overtime_categories" : "claim_categories";
  const data = tab === "overtime" ? overtime : claim;

  const openAdd = () => {
    setEditId(null);
    setFCode("");
    setFNameId("");
    setFNameEn("");
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (item: Category) => {
    setEditId(item.id);
    setFCode(item.code);
    setFNameId(item.name_id);
    setFNameEn(item.name_en);
    setFormError("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!fCode.trim()) {
      setFormError("Kode wajib diisi");
      return;
    }
    if (!fNameId.trim()) {
      setFormError("Nama (Indonesia) wajib diisi");
      return;
    }
    setFormError("");
    setSaving(true);

    const payload = {
      code: fCode,
      name_id: fNameId,
      name_en: fNameEn || fNameId,
    };

    try {
      if (editId) {
        const { error } = await supabase
          .from(table)
          .update(payload)
          .eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table).insert(payload);
        if (error) throw error;
      }
      setModalOpen(false);
      fetchAll();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from(table).delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    fetchAll();
  };

  const tabLabel = tab === "overtime" ? "Overtime" : "Claim";

  return (
    <div>
      <h1 className="page-title mb-6">Category</h1>

      <div className="card">
        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-4 gap-1">
          {(["overtime", "claim"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "overtime" ? "Overtime Category" : "Claim Category"}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-end px-4 py-3 border-b border-gray-100">
          <button onClick={openAdd} className="btn-primary">
            <Plus size={14} /> Add {tabLabel}
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : (
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Code {tabLabel}</th>
                  <th>{tabLabel} Name (Indonesia)</th>
                  <th>{tabLabel} Name (English)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="text-center py-16 text-gray-400 text-sm"
                    >
                      Belum ada kategori
                    </td>
                  </tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/60">
                      <td className="font-mono text-sm font-medium">
                        {item.code}
                      </td>
                      <td>{item.name_id}</td>
                      <td className="text-gray-600">{item.name_en}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(item)}
                            className="btn-icon text-blue-500"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(item)}
                            className="btn-icon text-red-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? `Edit ${tabLabel}` : `Add ${tabLabel}`}
        width="max-w-sm"
      >
        <div className="space-y-3">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {formError}
            </div>
          )}
          <div>
            <label className="form-label">Code {tabLabel} *</label>
            <input
              className="form-input font-mono"
              value={fCode}
              onChange={(e) => setFCode(e.target.value)}
              placeholder="R-1"
            />
          </div>
          <div>
            <label className="form-label">{tabLabel} Name (Indonesia) *</label>
            <input
              className="form-input"
              value={fNameId}
              onChange={(e) => setFNameId(e.target.value)}
              placeholder="Pekerjaan Menumpuk"
            />
          </div>
          <div>
            <label className="form-label">{tabLabel} Name (English)</label>
            <input
              className="form-input"
              value={fNameEn}
              onChange={(e) => setFNameEn(e.target.value)}
              placeholder="Overloaded Work"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-5 pt-4 border-t border-gray-100">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? <Spinner className="w-4 h-4" /> : null} Simpan
          </button>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus Kategori"
        width="max-w-sm"
      >
        <p className="text-sm text-gray-600 mb-5">
          Yakin ingin menghapus <strong>{deleteTarget?.name_id}</strong>?
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setDeleteTarget(null)}
            className="btn-secondary"
          >
            Batal
          </button>
          <button onClick={handleDelete} className="btn-danger">
            Hapus
          </button>
        </div>
      </Modal>
    </div>
  );
}
