import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Upload, Smartphone, AlertTriangle, CheckCircle, Trash2, Link } from "lucide-react";
import { Spinner, EmptyState, Modal } from "../../components/ui";
import clsx from "clsx";

interface AppVersion {
  id: string;
  version_name: string;
  version_code: number;
  apk_url: string | null;
  release_notes: string | null;
  is_force_update: boolean;
  is_active: boolean;
  created_at: string;
}

export default function MobileAppVersionPage() {
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AppVersion | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    version_name: "",
    version_code: "",
    release_notes: "",
    apk_url: "",
    is_force_update: false,
  });

  const fetchVersions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("app_versions")
      .select("*")
      .order("version_code", { ascending: false });
    setVersions((data || []) as AppVersion[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchVersions();
  }, []);

  const latest = versions[0] ?? null;

  // Convert Google Drive share URL to direct download URL
  const normalizeGDriveUrl = (url: string) => {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return `https://drive.google.com/uc?export=download&id=${match[1]}`;
    return url;
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess("");
    if (!form.version_name.trim()) return setError("Version name wajib diisi");
    if (!form.version_code || isNaN(Number(form.version_code)))
      return setError("Version code harus berupa angka");
    if (!form.apk_url.trim()) return setError("URL APK wajib diisi");

    const vCode = Number(form.version_code);
    if (versions.some((v) => v.version_code === vCode)) {
      return setError(`Version code ${vCode} sudah digunakan`);
    }

    setUploading(true);
    try {
      const apkUrl = normalizeGDriveUrl(form.apk_url.trim());

      // Deactivate previous versions
      await supabase.from("app_versions").update({ is_active: false }).neq("id", "00000000-0000-0000-0000-000000000000");

      // Insert new version as active
      const { error: insertErr } = await supabase.from("app_versions").insert({
        version_name: form.version_name.trim(),
        version_code: vCode,
        apk_url: apkUrl,
        release_notes: form.release_notes.trim() || null,
        is_force_update: form.is_force_update,
        is_active: true,
      });

      if (insertErr) throw new Error(insertErr.message);

      setSuccess(`Versi ${form.version_name} berhasil dipublish!`);
      setForm({ version_name: "", version_code: "", release_notes: "", apk_url: "", is_force_update: false });
      setShowForm(false);
      fetchVersions();
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setUploading(false);
    }
  };

  const handleSetActive = async (v: AppVersion) => {
    await supabase.from("app_versions").update({ is_active: false }).neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("app_versions").update({ is_active: true }).eq("id", v.id);
    fetchVersions();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from("app_versions").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    fetchVersions();
  };

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Mobile App Version</h1>
        <button
          onClick={() => { setShowForm(!showForm); setError(""); setSuccess(""); }}
          className="btn-primary"
        >
          <Upload size={14} /> Rilis Versi Baru
        </button>
      </div>

      {/* Latest Version Banner */}
      {latest && (
        <div className={clsx(
          "card p-4 mb-4 flex items-start gap-3",
          latest.is_active ? "border-l-4 border-green-500" : ""
        )}>
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
            <Smartphone size={20} className="text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">
                Versi Aktif: {versions.find(v => v.is_active)?.version_name ?? "-"}
              </span>
              <span className="badge badge-green">
                v{versions.find(v => v.is_active)?.version_code}
              </span>
              {versions.find(v => v.is_active)?.is_force_update && (
                <span className="badge badge-red flex items-center gap-1">
                  <AlertTriangle size={10} /> Force Update
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Dirilis {fmtDate(versions.find(v => v.is_active)?.created_at ?? latest.created_at)}
            </p>
            {versions.find(v => v.is_active)?.release_notes && (
              <p className="text-sm text-gray-600 mt-1.5">
                {versions.find(v => v.is_active)?.release_notes}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Form Rilis Baru */}
      {showForm && (
        <div className="card p-5 mb-4">
          <h2 className="font-semibold text-gray-900 mb-4">Rilis Versi Baru</h2>

          {error && (
            <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="form-label">Version Name *</label>
              <input
                className="form-input"
                placeholder="contoh: 1.0.1"
                value={form.version_name}
                onChange={(e) => setForm({ ...form, version_name: e.target.value })}
              />
              <p className="text-xs text-gray-400 mt-1">
                Harus cocok dengan version di pubspec.yaml
              </p>
            </div>
            <div>
              <label className="form-label">Version Code *</label>
              <input
                className="form-input"
                type="number"
                placeholder="contoh: 2"
                value={form.version_code}
                onChange={(e) => setForm({ ...form, version_code: e.target.value })}
              />
              <p className="text-xs text-gray-400 mt-1">
                Angka bulat, harus lebih besar dari versi sebelumnya
              </p>
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label">Release Notes</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Perubahan pada versi ini..."
              value={form.release_notes}
              onChange={(e) => setForm({ ...form, release_notes: e.target.value })}
            />
          </div>

          <div className="mb-4">
            <label className="form-label">URL APK *</label>
            <div className="relative">
              <Link size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="form-input pl-8"
                placeholder="https://drive.google.com/file/d/... atau URL lainnya"
                value={form.apk_url}
                onChange={(e) => setForm({ ...form, apk_url: e.target.value })}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Paste link Google Drive (share → Anyone with the link). URL akan otomatis dikonversi ke direct download.
            </p>
          </div>

          <div className="mb-5 flex items-center gap-3">
            <input
              type="checkbox"
              id="force-update"
              checked={form.is_force_update}
              onChange={(e) => setForm({ ...form, is_force_update: e.target.checked })}
              className="w-4 h-4 rounded accent-red-500"
            />
            <label htmlFor="force-update" className="text-sm font-medium text-gray-700">
              Force Update{" "}
              <span className="text-xs text-gray-400 font-normal">
                — user tidak bisa tutup popup, wajib update
              </span>
            </label>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowForm(false); setError(""); setApkFile(null); }}
              className="btn-secondary"
              disabled={uploading}
            >
              Batal
            </button>
            <button
              onClick={handleSubmit}
              className="btn-primary"
              disabled={uploading}
            >
              {uploading ? <><Spinner className="w-3.5 h-3.5" /> Menyimpan...</> : <><Upload size={14} /> Publish</>}
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="p-3 mb-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
          <CheckCircle size={15} /> {success}
        </div>
      )}

      {/* Version History */}
      <div className="card">
        <div className="px-4 py-3 border-b border-gray-50">
          <h2 className="font-medium text-gray-700 text-sm">Riwayat Versi</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Version</th>
                <th>Release Notes</th>
                <th>Force Update</th>
                <th>Status</th>
                <th>Tanggal Rilis</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <Spinner className="mx-auto" />
                  </td>
                </tr>
              ) : versions.length === 0 ? (
                <EmptyState message="Belum ada versi yang dirilis" />
              ) : (
                versions.map((v) => (
                  <tr key={v.id} className={clsx("hover:bg-gray-50/60", v.is_active && "bg-green-50/40")}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{v.version_name}</span>
                        <span className="badge badge-gray text-xs">code {v.version_code}</span>
                      </div>
                      {v.apk_url && (
                        <a
                          href={v.apk_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-500 hover:underline mt-0.5 block"
                        >
                          Download APK
                        </a>
                      )}
                    </td>
                    <td className="text-sm text-gray-600 max-w-xs">
                      {v.release_notes || <span className="text-gray-300">-</span>}
                    </td>
                    <td>
                      {v.is_force_update ? (
                        <span className="badge badge-red flex items-center gap-1 w-fit">
                          <AlertTriangle size={10} /> Ya
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">Tidak</span>
                      )}
                    </td>
                    <td>
                      {v.is_active ? (
                        <span className="badge badge-green">Aktif</span>
                      ) : (
                        <span className="badge badge-gray">Nonaktif</span>
                      )}
                    </td>
                    <td className="text-xs text-gray-500 font-mono whitespace-nowrap">
                      {fmtDate(v.created_at)}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        {!v.is_active && (
                          <button
                            onClick={() => handleSetActive(v)}
                            className="btn-icon text-green-600"
                            title="Set sebagai versi aktif"
                          >
                            <CheckCircle size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTarget(v)}
                          className="btn-icon text-red-400"
                          title="Hapus"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirm Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus Versi"
        width="max-w-sm"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Hapus versi <strong>{deleteTarget.version_name}</strong> (code {deleteTarget.version_code})?
              {deleteTarget.is_active && (
                <span className="block mt-1 text-red-600 font-medium">
                  ⚠ Ini adalah versi aktif. Pastikan ada versi lain yang diaktifkan.
                </span>
              )}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary">
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn-danger"
              >
                {deleting ? <Spinner className="w-3.5 h-3.5" /> : <Trash2 size={14} />}
                Hapus
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
