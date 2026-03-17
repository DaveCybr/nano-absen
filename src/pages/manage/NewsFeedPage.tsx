import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react'
import { Spinner, EmptyState, Pagination, Modal } from '../../components/ui'
import { useAuth } from '../../hooks/useAuth'

interface NewsFeedRow {
  id: string
  title: string
  content: string | null
  image_url: string | null
  is_published: boolean
  published_at: string | null
  created_at: string
  created_by: string | null
}

export default function NewsFeedPage() {
  const { employee } = useAuth()
  const [rows, setRows]           = useState<NewsFeedRow[]>([])
  const [loading, setLoading]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [page, setPage]           = useState(1)
  const [pageSize, setPageSize]   = useState(10)
  const [total, setTotal]         = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<NewsFeedRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<NewsFeedRow | null>(null)
  const [formError, setFormError] = useState('')
  const [fTitle, setFTitle]       = useState('')
  const [fContent, setFContent]   = useState('')
  const [fPublished, setFPublished] = useState(false)

  const fetchFeeds = useCallback(async () => {
    setLoading(true)
    const { data, count } = await supabase
      .from('news_feeds')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)
    setRows((data || []) as NewsFeedRow[])
    setTotal(count || 0)
    setLoading(false)
  }, [page, pageSize])

  useEffect(() => { fetchFeeds() }, [fetchFeeds])

  const openAdd = () => {
    setEditTarget(null)
    setFTitle(''); setFContent(''); setFPublished(false)
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (row: NewsFeedRow) => {
    setEditTarget(row)
    setFTitle(row.title); setFContent(row.content || ''); setFPublished(row.is_published)
    setFormError('')
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!fTitle.trim()) { setFormError('Judul wajib diisi'); return }
    setFormError('')
    setSaving(true)

    const payload = {
      title: fTitle,
      content: fContent || null,
      is_published: fPublished,
      published_at: fPublished ? new Date().toISOString() : null,
      created_by: employee?.id || null,
      updated_at: new Date().toISOString(),
    }

    try {
      if (editTarget) {
        const { error } = await supabase.from('news_feeds').update(payload).eq('id', editTarget.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('news_feeds').insert(payload)
        if (error) throw error
      }
      setModalOpen(false)
      fetchFeeds()
    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async (row: NewsFeedRow) => {
    await supabase.from('news_feeds').update({
      is_published: !row.is_published,
      published_at: !row.is_published ? new Date().toISOString() : null,
    }).eq('id', row.id)
    fetchFeeds()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await supabase.from('news_feeds').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    fetchFeeds()
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">News Feed</h1>
        <button onClick={openAdd} className="btn-primary"><Plus size={14} /> Tambah Berita</button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Title</th>
                <th>Content</th>
                <th>Status</th>
                <th>Published At</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-16"><Spinner className="mx-auto" /></td></tr>
              ) : rows.length === 0 ? (
                <EmptyState message="Belum ada berita" />
              ) : (
                rows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50/60">
                    <td className="font-medium text-gray-900 max-w-[200px]">
                      <p className="truncate">{row.title}</p>
                    </td>
                    <td className="text-gray-500 text-sm max-w-[240px]">
                      <p className="truncate">{row.content || '-'}</p>
                    </td>
                    <td>
                      {row.is_published
                        ? <span className="badge badge-green">Published</span>
                        : <span className="badge badge-gray">Draft</span>}
                    </td>
                    <td className="text-xs text-gray-500 whitespace-nowrap">
                      {row.published_at ? formatDate(row.published_at) : '-'}
                    </td>
                    <td className="text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(row.created_at)}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => togglePublish(row)}
                          className={`btn-icon ${row.is_published ? 'text-orange-400' : 'text-green-500'}`}
                          title={row.is_published ? 'Unpublish' : 'Publish'}>
                          {row.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button onClick={() => openEdit(row)} className="btn-icon text-blue-500">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => setDeleteTarget(row)} className="btn-icon text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={setPageSize} />
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editTarget ? 'Edit Berita' : 'Tambah Berita'} width="max-w-lg">
        <div className="space-y-4">
          {formError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>}
          <div>
            <label className="form-label">Judul *</label>
            <input className="form-input" value={fTitle} onChange={e => setFTitle(e.target.value)}
              placeholder="Judul pengumuman..." />
          </div>
          <div>
            <label className="form-label">Konten</label>
            <textarea className="form-input" rows={5} value={fContent}
              onChange={e => setFContent(e.target.value)}
              placeholder="Isi pengumuman..." />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={fPublished} onChange={e => setFPublished(e.target.checked)}
              className="accent-blue-600" />
            <span className="text-sm text-gray-700">Publish sekarang</span>
          </label>
        </div>
        <div className="flex gap-2 justify-end mt-5 pt-4 border-t border-gray-100">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Batal</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Spinner className="w-4 h-4" /> : null} Simpan
          </button>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus Berita" width="max-w-sm">
        <p className="text-sm text-gray-600 mb-5">Yakin ingin menghapus berita <strong>{deleteTarget?.title}</strong>?</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Batal</button>
          <button onClick={handleDelete} className="btn-danger">Hapus</button>
        </div>
      </Modal>
    </div>
  )
}
