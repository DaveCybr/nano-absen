import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { Spinner, Modal } from '../../components/ui'
import type { Position, Grade, EmploymentStatus } from '../../types'

type Tab = 'position' | 'grade' | 'employment_status'

function ActionBtns({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={onEdit} className="btn-icon text-blue-500"><Edit2 size={14} /></button>
      <button onClick={onDelete} className="btn-icon text-red-400"><Trash2 size={14} /></button>
    </div>
  )
}

export default function HierarchyPage() {
  const [tab, setTab] = useState<Tab>('position')

  const [positions, setPositions]     = useState<Position[]>([])
  const [grades, setGrades]           = useState<Grade[]>([])
  const [empStatuses, setEmpStatuses] = useState<EmploymentStatus[]>([])
  const [loading, setLoading]         = useState(false)
  const [saving, setSaving]           = useState(false)

  const [modalOpen, setModalOpen]     = useState(false)
  const [editId, setEditId]           = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [formError, setFormError]     = useState('')

  const [fCode, setFCode]     = useState('')
  const [fNameId, setFNameId] = useState('')
  const [fNameEn, setFNameEn] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [p, g, e] = await Promise.all([
      supabase.from('positions').select('*').order('code'),
      supabase.from('grades').select('*').order('code'),
      supabase.from('employment_statuses').select('*').order('name_id'),
    ])
    setPositions((p.data || []) as Position[])
    setGrades((g.data || []) as Grade[])
    setEmpStatuses((e.data || []) as EmploymentStatus[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const openAdd = () => {
    setEditId(null)
    setFCode(''); setFNameId(''); setFNameEn('')
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (item: any) => {
    setEditId(item.id)
    setFCode(item.code || '')
    setFNameId(item.name || item.name_id || '')
    setFNameEn(item.name_en || '')
    setFormError('')
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!fNameId.trim()) { setFormError('Nama wajib diisi'); return }
    setFormError('')
    setSaving(true)

    try {
      if (tab === 'position') {
        const payload = { code: fCode, name: fNameId }
        if (editId) await supabase.from('positions').update(payload).eq('id', editId)
        else await supabase.from('positions').insert(payload)
      } else if (tab === 'grade') {
        const payload = { code: fCode, name: fNameId }
        if (editId) await supabase.from('grades').update(payload).eq('id', editId)
        else await supabase.from('grades').insert(payload)
      } else {
        const payload = { name_id: fNameId, name_en: fNameEn || fNameId }
        if (editId) await supabase.from('employment_statuses').update(payload).eq('id', editId)
        else await supabase.from('employment_statuses').insert(payload)
      }
      setModalOpen(false)
      fetchAll()
    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const table = tab === 'position' ? 'positions' : tab === 'grade' ? 'grades' : 'employment_statuses'
    await supabase.from(table).delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    fetchAll()
  }

  const tabs = [
    { id: 'position' as Tab,          label: 'Position' },
    { id: 'grade' as Tab,             label: 'Grade' },
    { id: 'employment_status' as Tab, label: 'Employment Status' },
  ]

  return (
    <div>
      <h1 className="page-title mb-6">Hierarchy</h1>

      <div className="card">
        <div className="flex border-b border-gray-100 px-4 gap-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end px-4 py-3 border-b border-gray-100">
          <button onClick={openAdd} className="btn-primary">
            <Plus size={14} /> Add {tab === 'position' ? 'Position' : tab === 'grade' ? 'Grade' : 'Status'}
          </button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : tab === 'position' ? (
            <table className="data-table w-full">
              <thead><tr>
                <th className="w-16">No</th>
                <th>Position Code</th>
                <th>Position Name</th>
                <th>Action</th>
              </tr></thead>
              <tbody>
                {positions.length === 0
                  ? <tr><td colSpan={4} className="text-center py-16 text-gray-400 text-sm">Belum ada posisi</td></tr>
                  : positions.map((p, i) => (
                    <tr key={p.id} className="hover:bg-gray-50/60">
                      <td className="text-gray-500">{i + 1}</td>
                      <td className="font-mono text-sm">{p.code}</td>
                      <td className="font-medium">{p.name}</td>
                      <td><ActionBtns onEdit={() => openEdit(p)} onDelete={() => setDeleteTarget({ id: p.id, name: p.name })} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : tab === 'grade' ? (
            <table className="data-table w-full">
              <thead><tr>
                <th className="w-16">No</th>
                <th>Grade Code</th>
                <th>Grade Name</th>
                <th>Action</th>
              </tr></thead>
              <tbody>
                {grades.length === 0
                  ? <tr><td colSpan={4} className="text-center py-16 text-gray-400 text-sm">Belum ada grade</td></tr>
                  : grades.map((g, i) => (
                    <tr key={g.id} className="hover:bg-gray-50/60">
                      <td className="text-gray-500">{i + 1}</td>
                      <td className="font-mono text-sm">{g.code}</td>
                      <td className="font-medium">{g.name}</td>
                      <td><ActionBtns onEdit={() => openEdit(g)} onDelete={() => setDeleteTarget({ id: g.id, name: g.name })} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <table className="data-table w-full">
              <thead><tr>
                <th className="w-16">No</th>
                <th>Status Name (Indonesia)</th>
                <th>Status Name (English)</th>
                <th>Action</th>
              </tr></thead>
              <tbody>
                {empStatuses.length === 0
                  ? <tr><td colSpan={4} className="text-center py-16 text-gray-400 text-sm">Belum ada status</td></tr>
                  : empStatuses.map((s, i) => (
                    <tr key={s.id} className="hover:bg-gray-50/60">
                      <td className="text-gray-500">{i + 1}</td>
                      <td className="font-medium">{s.name_id}</td>
                      <td className="text-gray-600">{s.name_en}</td>
                      <td><ActionBtns onEdit={() => openEdit({ ...s, name: s.name_id })} onDelete={() => setDeleteTarget({ id: s.id, name: s.name_id })} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editId
          ? `Edit ${tab === 'position' ? 'Position' : tab === 'grade' ? 'Grade' : 'Status'}`
          : `Add ${tab === 'position' ? 'Position' : tab === 'grade' ? 'Grade' : 'Status'}`}
        width="max-w-sm">
        <div className="space-y-3">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>
          )}
          {tab !== 'employment_status' && (
            <div>
              <label className="form-label">{tab === 'position' ? 'Position Code' : 'Grade Code'}</label>
              <input className="form-input" value={fCode} onChange={e => setFCode(e.target.value)}
                placeholder={tab === 'position' ? 'PD1' : 'G1'} />
            </div>
          )}
          <div>
            <label className="form-label">
              {tab === 'employment_status' ? 'Status Name (Indonesia)' :
               tab === 'position' ? 'Position Name' : 'Grade Name'} *
            </label>
            <input className="form-input" value={fNameId} onChange={e => setFNameId(e.target.value)}
              placeholder={tab === 'employment_status' ? 'Tetap' : tab === 'position' ? 'Supervisor' : 'Grade 1'} />
          </div>
          {tab === 'employment_status' && (
            <div>
              <label className="form-label">Status Name (English)</label>
              <input className="form-input" value={fNameEn} onChange={e => setFNameEn(e.target.value)}
                placeholder="Permanent" />
            </div>
          )}
        </div>
        <div className="flex gap-2 justify-end mt-5 pt-4 border-t border-gray-100">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Batal</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Spinner className="w-4 h-4" /> : null} Simpan
          </button>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        title="Hapus Data" width="max-w-sm">
        <p className="text-sm text-gray-600 mb-5">
          Yakin ingin menghapus <strong>{deleteTarget?.name}</strong>?
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Batal</button>
          <button onClick={handleDelete} className="btn-danger">Hapus</button>
        </div>
      </Modal>
    </div>
  )
}
