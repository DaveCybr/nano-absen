import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Edit2, Trash2, ChevronRight, ChevronDown } from 'lucide-react'
import { Spinner, Modal } from '../../components/ui'
import type { Group, Zone } from '../../types'
import clsx from 'clsx'

interface GroupWithChildren extends Group {
  children?: GroupWithChildren[]
  zones?: Zone[]
}

const DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
]

const EMPTY_FORM = {
  name: '',
  parent_group_id: '',
  level: 1,
  schedule_type: 'regular' as 'regular' | 'shifting',
  mandatory_checkout: false,
  strict_area_in: false,
  strict_area_out: false,
  tolerance_minutes: 10,
  timezone: 'Asia/Jakarta',
  zone_ids: [] as string[],
  schedule_in_mon: '08:00', schedule_out_mon: '16:00',
  schedule_in_tue: '08:00', schedule_out_tue: '16:00',
  schedule_in_wed: '08:00', schedule_out_wed: '16:00',
  schedule_in_thu: '08:00', schedule_out_thu: '16:00',
  schedule_in_fri: '08:00', schedule_out_fri: '16:00',
  schedule_in_sat: '08:00', schedule_out_sat: '16:00',
  schedule_in_sun: '00:00', schedule_out_sun: '00:00',
}

function buildTree(groups: Group[]): GroupWithChildren[] {
  const map = new Map<string, GroupWithChildren>()
  groups.forEach(g => map.set(g.id, { ...g, children: [] }))
  const roots: GroupWithChildren[] = []
  map.forEach(g => {
    if (g.parent_group_id && map.has(g.parent_group_id)) {
      map.get(g.parent_group_id)!.children!.push(g)
    } else {
      roots.push(g)
    }
  })
  return roots
}

function GroupTreeItem({
  group, depth, onEdit, onDelete, selectedId, onSelect,
}: {
  group: GroupWithChildren
  depth: number
  onEdit: (g: Group) => void
  onDelete: (g: Group) => void
  selectedId: string | null
  onSelect: (g: GroupWithChildren) => void
}) {
  const [open, setOpen] = useState(depth === 0)
  const hasChildren = (group.children?.length || 0) > 0

  return (
    <div>
      <div
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors group',
          selectedId === group.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => onSelect(group)}
      >
        {hasChildren ? (
          <button onClick={e => { e.stopPropagation(); setOpen(p => !p) }}
            className="text-gray-400 hover:text-gray-600">
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-4 h-4 border border-gray-200 rounded-sm bg-gray-100 inline-block" />
        )}
        <span className="flex-1 text-sm font-medium">{group.name}</span>
        <div className="hidden group-hover:flex items-center gap-1">
          <button onClick={e => { e.stopPropagation(); onEdit(group) }}
            className="btn-icon w-6 h-6 text-blue-500"><Edit2 size={12} /></button>
          <button onClick={e => { e.stopPropagation(); onDelete(group) }}
            className="btn-icon w-6 h-6 text-red-400"><Trash2 size={12} /></button>
        </div>
      </div>
      {open && hasChildren && (
        <div>
          {group.children!.map(child => (
            <GroupTreeItem key={child.id} group={child} depth={depth + 1}
              onEdit={onEdit} onDelete={onDelete} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function GroupsPage() {
  const [groups, setGroups]       = useState<Group[]>([])
  const [zones, setZones]         = useState<Zone[]>([])
  const [tree, setTree]           = useState<GroupWithChildren[]>([])
  const [loading, setLoading]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [selected, setSelected]   = useState<GroupWithChildren | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Group | null>(null)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null)

  const fetchGroups = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('groups').select('*').order('level').order('name')
    const { data: zoneData } = await supabase.from('zones').select('*').order('office_name')
    const allGroups = (data || []) as Group[]
    setGroups(allGroups)
    setZones((zoneData || []) as Zone[])
    setTree(buildTree(allGroups))
    setLoading(false)
  }, [])

  useEffect(() => { fetchGroups() }, [fetchGroups])

  const openAdd = () => {
    setEditTarget(null)
    setForm({ ...EMPTY_FORM })
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (g: Group) => {
    setEditTarget(g)
    setFormError('')
    supabase.from('group_zones').select('zone_id').eq('group_id', g.id).then(({ data }) => {
      setForm({
        name: g.name,
        parent_group_id: g.parent_group_id || '',
        level: g.level,
        schedule_type: g.schedule_type,
        mandatory_checkout: g.mandatory_checkout,
        strict_area_in: g.strict_area_in,
        strict_area_out: g.strict_area_out,
        tolerance_minutes: g.tolerance_minutes,
        timezone: g.timezone,
        zone_ids: (data || []).map((d: any) => d.zone_id),
        schedule_in_mon:  g.schedule_in_mon  || '08:00',
        schedule_out_mon: g.schedule_out_mon || '16:00',
        schedule_in_tue:  g.schedule_in_tue  || '08:00',
        schedule_out_tue: g.schedule_out_tue || '16:00',
        schedule_in_wed:  g.schedule_in_wed  || '08:00',
        schedule_out_wed: g.schedule_out_wed || '16:00',
        schedule_in_thu:  g.schedule_in_thu  || '08:00',
        schedule_out_thu: g.schedule_out_thu || '16:00',
        schedule_in_fri:  g.schedule_in_fri  || '08:00',
        schedule_out_fri: g.schedule_out_fri || '16:00',
        schedule_in_sat:  g.schedule_in_sat  || '08:00',
        schedule_out_sat: g.schedule_out_sat || '16:00',
        schedule_in_sun:  g.schedule_in_sun  || '00:00',
        schedule_out_sun: g.schedule_out_sun || '00:00',
      })
      setModalOpen(true)
    })
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Nama group wajib diisi'); return }
    setFormError('')
    setSaving(true)

    const payload: any = {
      name: form.name,
      parent_group_id: form.parent_group_id || null,
      level: form.level,
      schedule_type: form.schedule_type,
      mandatory_checkout: form.mandatory_checkout,
      strict_area_in: form.strict_area_in,
      strict_area_out: form.strict_area_out,
      tolerance_minutes: Number(form.tolerance_minutes),
      timezone: form.timezone,
      updated_at: new Date().toISOString(),
    }

    if (form.schedule_type === 'regular') {
      DAYS.forEach(d => {
        payload[`schedule_in_${d.key}`]  = (form as any)[`schedule_in_${d.key}`]  || null
        payload[`schedule_out_${d.key}`] = (form as any)[`schedule_out_${d.key}`] || null
      })
    }

    try {
      let groupId = editTarget?.id
      if (editTarget) {
        const { error } = await supabase.from('groups').update(payload).eq('id', editTarget.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('groups').insert(payload).select('id').single()
        if (error) throw error
        groupId = data.id
      }

      if (groupId) {
        await supabase.from('group_zones').delete().eq('group_id', groupId)
        if (form.zone_ids.length > 0) {
          await supabase.from('group_zones').insert(
            form.zone_ids.map(zid => ({ group_id: groupId, zone_id: zid }))
          )
        }
      }

      setModalOpen(false)
      fetchGroups()
    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await supabase.from('groups').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    if (selected?.id === deleteTarget.id) setSelected(null)
    fetchGroups()
  }

  const toggleZone = (zoneId: string) => {
    setForm(p => ({
      ...p,
      zone_ids: p.zone_ids.includes(zoneId)
        ? p.zone_ids.filter(id => id !== zoneId)
        : [...p.zone_ids, zoneId]
    }))
  }

  const setField = (key: string, val: any) => setForm(p => ({ ...p, [key]: val }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Group</h1>
        <button onClick={openAdd} className="btn-primary"><Plus size={14} /> Add Group</button>
      </div>

      <div className="flex gap-4">
        {/* Tree panel */}
        <div className="w-72 shrink-0 card p-3">
          <div className="mb-2 px-2">
            <input className="form-input text-xs py-1.5" placeholder="Find a Group..." />
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : tree.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Belum ada group</p>
          ) : (
            tree.map(g => (
              <GroupTreeItem key={g.id} group={g} depth={0}
                onEdit={openEdit} onDelete={setDeleteTarget}
                selectedId={selected?.id || null}
                onSelect={setSelected}
              />
            ))
          )}
        </div>

        {/* Detail panel */}
        <div className="flex-1 card p-6">
          {selected ? (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-gray-900">Group Details</h2>
                <button onClick={() => openEdit(selected)} className="btn-primary">
                  <Edit2 size={13} /> Edit
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                {[
                  { label: 'Group Name',         value: selected.name },
                  { label: 'Level',              value: selected.level },
                  { label: 'Schedule Type',      value: selected.schedule_type === 'regular' ? 'Regular' : 'Shifting' },
                  { label: 'Timezone',           value: selected.timezone },
                  { label: 'Tolerance',          value: `${selected.tolerance_minutes} minutes` },
                  { label: 'Mandatory Checkout', value: selected.mandatory_checkout ? 'Ya' : 'Tidak' },
                  { label: 'Strict Area In',     value: selected.strict_area_in ? 'Ya' : 'Tidak' },
                  { label: 'Strict Area Out',    value: selected.strict_area_out ? 'Ya' : 'Tidak' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                    <p className="font-medium text-gray-900">{value}</p>
                  </div>
                ))}
              </div>

              {selected.schedule_type === 'regular' && (
                <div className="mt-6">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Schedule</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="text-left text-xs text-gray-500 font-medium pb-2 pr-4">Day</th>
                          <th className="text-left text-xs text-gray-500 font-medium pb-2 pr-4">Schedule In</th>
                          <th className="text-left text-xs text-gray-500 font-medium pb-2">Schedule Out</th>
                        </tr>
                      </thead>
                      <tbody>
                        {DAYS.map(d => (
                          <tr key={d.key} className="border-t border-gray-50">
                            <td className="py-2 pr-4 font-medium text-gray-700">{d.label}</td>
                            <td className="py-2 pr-4 font-mono text-gray-600">
                              {(selected as any)[`schedule_in_${d.key}`] || '00:00'}
                            </td>
                            <td className="py-2 font-mono text-gray-600">
                              {(selected as any)[`schedule_out_${d.key}`] || '00:00'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              Pilih group dari daftar untuk melihat detail
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editTarget ? `Edit Group: ${editTarget.name}` : 'Add Group'}
        width="max-w-3xl">
        <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="form-label">Group Name *</label>
              <input className="form-input" value={form.name} onChange={e => setField('name', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Select Zones</label>
              <div className="border border-gray-200 rounded-lg p-2 max-h-28 overflow-y-auto space-y-1">
                {zones.length === 0
                  ? <p className="text-xs text-gray-400 py-1">Belum ada zone</p>
                  : zones.map(z => (
                    <label key={z.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                      <input type="checkbox" checked={form.zone_ids.includes(z.id)}
                        onChange={() => toggleZone(z.id)} className="accent-blue-600" />
                      <span className="text-sm text-gray-700">{z.office_name}</span>
                    </label>
                  ))}
              </div>
            </div>
            <div>
              <label className="form-label">Select Parent Group</label>
              <select className="form-input" value={form.parent_group_id}
                onChange={e => setField('parent_group_id', e.target.value)}>
                <option value="">— Root Group —</option>
                {groups.filter(g => g.id !== editTarget?.id).map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Level</label>
              <input className="form-input" type="number" min={1} max={10}
                value={form.level} onChange={e => setField('level', Number(e.target.value))} />
            </div>
            <div>
              <label className="form-label">Schedule Type</label>
              <select className="form-input" value={form.schedule_type}
                onChange={e => setField('schedule_type', e.target.value)}>
                <option value="regular">Regular</option>
                <option value="shifting">Shifting</option>
              </select>
              {form.schedule_type === 'shifting' && (
                <p className="text-xs text-blue-600 mt-1">Jadwal diatur di menu Shifting</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Lock Time Attendance</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.mandatory_checkout}
                onChange={e => setField('mandatory_checkout', e.target.checked)} className="accent-blue-600" />
              <span className="text-sm text-gray-700">Mandatory Checkout</span>
              <span className="text-xs text-gray-400">(Users will be recorded as absent if they don't check out)</span>
            </label>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Lock Location Attendance</p>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.strict_area_in}
                  onChange={e => setField('strict_area_in', e.target.checked)} className="accent-blue-600" />
                <span className="text-sm text-gray-700">Strict Area In</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.strict_area_out}
                  onChange={e => setField('strict_area_out', e.target.checked)} className="accent-blue-600" />
                <span className="text-sm text-gray-700">Strict Area Out</span>
              </label>
            </div>
          </div>

          {form.schedule_type === 'regular' && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Schedule</p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <label className="form-label">Tolerance (minutes)</label>
                  <input className="form-input" type="number" min={0}
                    value={form.tolerance_minutes} onChange={e => setField('tolerance_minutes', Number(e.target.value))} />
                </div>
                <div>
                  <label className="form-label">Timezone</label>
                  <select className="form-input" value={form.timezone} onChange={e => setField('timezone', e.target.value)}>
                    <option value="Asia/Jakarta">WIB</option>
                    <option value="Asia/Makassar">WITA</option>
                    <option value="Asia/Jayapura">WIT</option>
                  </select>
                </div>
              </div>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left text-xs text-gray-500 font-semibold px-4 py-2">Day</th>
                      <th className="text-left text-xs text-gray-500 font-semibold px-4 py-2">Schedule In</th>
                      <th className="text-left text-xs text-gray-500 font-semibold px-4 py-2">Schedule Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map(d => (
                      <tr key={d.key} className="border-t border-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-700">{d.label}</td>
                        <td className="px-4 py-2">
                          <input type="time" className="form-input py-1 text-xs w-28"
                            value={(form as any)[`schedule_in_${d.key}`]}
                            onChange={e => setField(`schedule_in_${d.key}`, e.target.value)} />
                        </td>
                        <td className="px-4 py-2">
                          <input type="time" className="form-input py-1 text-xs w-28"
                            value={(form as any)[`schedule_out_${d.key}`]}
                            onChange={e => setField(`schedule_out_${d.key}`, e.target.value)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
        title="Hapus Group" width="max-w-sm">
        <p className="text-sm text-gray-600 mb-5">
          Yakin ingin menghapus group <strong>{deleteTarget?.name}</strong>?
          Semua sub-group dan karyawan di group ini akan terpengaruh.
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Batal</button>
          <button onClick={handleDelete} className="btn-danger">Hapus</button>
        </div>
      </Modal>
    </div>
  )
}
