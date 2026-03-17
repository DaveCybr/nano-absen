import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Edit2, FileText, Download } from 'lucide-react'
import { Spinner, EmptyState, Pagination, Modal } from '../../components/ui'
import type { LeaveCategory, LeaveBalance, Group } from '../../types'

type Tab = 'balance' | 'category'

export default function LeavePage() {
  const [tab, setTab] = useState<Tab>('balance')

  const [balances, setBalances]   = useState<(LeaveBalance & { employee: any; leave_category: LeaveCategory })[]>([])
  const [groups, setGroups]       = useState<Group[]>([])
  const [groupFilter, setGroupFilter] = useState('all')
  const [loadingBal, setLoadingBal] = useState(false)
  const [pageBal, setPageBal]     = useState(1)
  const [pageSizeBal, setPageSizeBal] = useState(10)
  const [totalBal, setTotalBal]   = useState(0)

  const [categories, setCategories] = useState<LeaveCategory[]>([])
  const [loadingCat, setLoadingCat] = useState(false)
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [editCat, setEditCat]     = useState<LeaveCategory | null>(null)
  const [deleteCat, setDeleteCat] = useState<LeaveCategory | null>(null)
  const [savingCat, setSavingCat] = useState(false)
  const [catError, setCatError]   = useState('')

  const [fType, setFType]       = useState('special')
  const [fName, setFName]       = useState('')
  const [fLimit, setFLimit]     = useState('')
  const [fAmount, setFAmount]   = useState<'as_requested' | 'fixed'>('as_requested')
  const [fApproval, setFApproval] = useState('1')
  const [fMinPeriod, setFMinPeriod] = useState('0')

  const fetchCategories = async () => {
    setLoadingCat(true)
    const { data } = await supabase.from('leave_categories').select('*').order('leave_name')
    setCategories((data as LeaveCategory[]) || [])
    setLoadingCat(false)
  }

  useEffect(() => {
    supabase.from('groups').select('id,name').order('name').then(({ data }) => setGroups((data as Group[]) || []))
    fetchCategories()
  }, [])

  const fetchBalances = useCallback(async () => {
    setLoadingBal(true)
    let q = supabase
      .from('leave_balances')
      .select(`
        *,
        employee:employees(id,full_name,employee_code,group:groups(name)),
        leave_category:leave_categories(id,leave_name,leave_type)
      `, { count: 'exact' })
      .order('employee_id')

    if (groupFilter !== 'all') q = q.eq('employee.group_id', groupFilter)

    const { data, count } = await q.range((pageBal - 1) * pageSizeBal, pageBal * pageSizeBal - 1)
    setBalances((data || []) as any)
    setTotalBal(count || 0)
    setLoadingBal(false)
  }, [groupFilter, pageBal, pageSizeBal])

  useEffect(() => { fetchBalances() }, [fetchBalances])

  const openAddCat = () => {
    setEditCat(null)
    setFType('special'); setFName(''); setFLimit(''); setFAmount('as_requested')
    setFApproval('1'); setFMinPeriod('0')
    setCatError('')
    setCatModalOpen(true)
  }

  const openEditCat = (c: LeaveCategory) => {
    setEditCat(c)
    setFType(c.leave_type); setFName(c.leave_name)
    setFLimit(c.limit_per_year ? String(c.limit_per_year) : '')
    setFAmount(c.amount_per_taken); setFApproval(String(c.approval_level))
    setFMinPeriod('0')
    setCatError('')
    setCatModalOpen(true)
  }

  const handleSaveCat = async () => {
    if (!fName.trim()) { setCatError('Nama cuti wajib diisi'); return }
    setCatError('')
    setSavingCat(true)

    const payload = {
      leave_type: fType, leave_name: fName,
      limit_per_year: fLimit ? parseInt(fLimit) : null,
      amount_per_taken: fAmount,
      approval_level: parseInt(fApproval) || 1,
      min_working_period_days: parseInt(fMinPeriod) || 0,
    }

    try {
      if (editCat) {
        const { error } = await supabase.from('leave_categories').update(payload).eq('id', editCat.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('leave_categories').insert(payload)
        if (error) throw error
      }
      setCatModalOpen(false)
      fetchCategories()
    } catch (err: any) {
      setCatError(err.message)
    } finally {
      setSavingCat(false)
    }
  }

  const handleDeleteCat = async () => {
    if (!deleteCat) return
    await supabase.from('leave_categories').delete().eq('id', deleteCat.id)
    setDeleteCat(null)
    fetchCategories()
  }

  return (
    <div>
      <h1 className="page-title mb-6">Leave</h1>

      <div className="card">
        <div className="flex border-b border-gray-100 px-4 gap-1">
          {[
            { id: 'balance' as Tab,  label: 'Leave Balance' },
            { id: 'category' as Tab, label: 'Leave Category' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
          <div className="ml-auto flex items-center pb-2 gap-2">
            {tab === 'balance' && (
              <button className="btn-secondary text-xs"><Download size={13} /> Download Report</button>
            )}
            {tab === 'category' && (
              <button onClick={openAddCat} className="btn-primary"><Plus size={14} /> Add Leave Category</button>
            )}
          </div>
        </div>

        {tab === 'balance' && (
          <>
            <div className="flex items-center gap-3 p-4 border-b border-gray-50">
              <div>
                <label className="form-label">Find a Group</label>
                <select className="form-input w-40" value={groupFilter}
                  onChange={e => { setGroupFilter(e.target.value); setPageBal(1) }}>
                  <option value="all">All Group</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Full Name</th>
                    <th>Group</th>
                    <th>Working Period</th>
                    <th>Annual Leave Taken (Days)</th>
                    <th>Other Leave Taken (Days)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingBal ? (
                    <tr><td colSpan={7} className="text-center py-16"><Spinner className="mx-auto" /></td></tr>
                  ) : balances.length === 0 ? (
                    <EmptyState message="Belum ada data saldo cuti" />
                  ) : (
                    balances.map(b => (
                      <tr key={b.id} className="hover:bg-gray-50/60">
                        <td className="font-mono text-xs">{b.employee?.employee_code}</td>
                        <td className="font-medium">{b.employee?.full_name}</td>
                        <td><span className="badge badge-gray">{b.employee?.group?.name || '-'}</span></td>
                        <td className="text-gray-600">0/0</td>
                        <td className="text-center font-medium">{b.annual_taken}/{b.leave_category?.limit_per_year || '∞'}</td>
                        <td className="text-center font-medium">{b.other_taken}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button className="btn-icon text-blue-500"><FileText size={14} /></button>
                            <button className="btn-icon text-gray-500"><Edit2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={pageBal} pageSize={pageSizeBal} total={totalBal}
              onPage={setPageBal} onPageSize={setPageSizeBal} />
          </>
        )}

        {tab === 'category' && (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Leave Type</th>
                  <th>Leave Name</th>
                  <th>Leave Limit per Year (days)</th>
                  <th>Leave Amount per Taken (days)</th>
                  <th>Min Working Period</th>
                  <th>Approval Type</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loadingCat ? (
                  <tr><td colSpan={7} className="text-center py-16"><Spinner className="mx-auto" /></td></tr>
                ) : categories.length === 0 ? (
                  <EmptyState message="Belum ada kategori cuti" />
                ) : (
                  categories.map(cat => (
                    <tr key={cat.id} className="hover:bg-gray-50/60">
                      <td>
                        <span className={`badge ${cat.leave_type === 'sick' ? 'badge-yellow' : 'badge-blue'}`}>
                          {cat.leave_type === 'sick' ? 'Sick Leave' : cat.leave_type === 'annual' ? 'Annual Leave' : 'Special Leave'}
                        </span>
                      </td>
                      <td className="font-medium">{cat.leave_name}</td>
                      <td className="text-gray-600">{cat.limit_per_year || 'None'}</td>
                      <td className="text-gray-600">{cat.amount_per_taken === 'as_requested' ? 'As Requested' : 'Fixed'}</td>
                      <td className="text-gray-600">None</td>
                      <td className="text-gray-600">{cat.approval_level}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditCat(cat)} className="btn-icon text-blue-500"><Edit2 size={14} /></button>
                          <button onClick={() => setDeleteCat(cat)} className="btn-icon text-red-400"><span>✕</span></button>
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

      <Modal open={catModalOpen} onClose={() => setCatModalOpen(false)}
        title={editCat ? 'Edit Leave Category' : 'Add Leave Category'} width="max-w-md">
        <div className="space-y-3">
          {catError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{catError}</div>}
          <div>
            <label className="form-label">Leave Type</label>
            <select className="form-input" value={fType} onChange={e => setFType(e.target.value)}>
              <option value="annual">Annual Leave</option>
              <option value="sick">Sick Leave</option>
              <option value="special">Special Leave</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="form-label">Leave Name *</label>
            <input className="form-input" value={fName} onChange={e => setFName(e.target.value)} placeholder="Cuti Tahunan" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Leave Limit per Year</label>
              <input className="form-input" type="number" min={0} value={fLimit}
                onChange={e => setFLimit(e.target.value)} placeholder="Kosong = tidak terbatas" />
            </div>
            <div>
              <label className="form-label">Amount per Taken</label>
              <select className="form-input" value={fAmount} onChange={e => setFAmount(e.target.value as 'as_requested' | 'fixed')}>
                <option value="as_requested">As Requested</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
            <div>
              <label className="form-label">Min Working Period (days)</label>
              <input className="form-input" type="number" min={0} value={fMinPeriod}
                onChange={e => setFMinPeriod(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Approval Level</label>
              <input className="form-input" type="number" min={1} value={fApproval}
                onChange={e => setFApproval(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-5 pt-4 border-t border-gray-100">
          <button onClick={() => setCatModalOpen(false)} className="btn-secondary">Batal</button>
          <button onClick={handleSaveCat} disabled={savingCat} className="btn-primary">
            {savingCat ? <Spinner className="w-4 h-4" /> : null} Simpan
          </button>
        </div>
      </Modal>

      <Modal open={!!deleteCat} onClose={() => setDeleteCat(null)} title="Hapus Kategori Cuti" width="max-w-sm">
        <p className="text-sm text-gray-600 mb-5">Yakin ingin menghapus kategori <strong>{deleteCat?.leave_name}</strong>?</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setDeleteCat(null)} className="btn-secondary">Batal</button>
          <button onClick={handleDeleteCat} className="btn-danger">Hapus</button>
        </div>
      </Modal>
    </div>
  )
}
