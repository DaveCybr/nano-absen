import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Edit2, FileText, Download, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { Spinner, EmptyState, Pagination, Modal } from '../../components/ui'
import { exportCsv } from '../../lib/exportCsv'
import type { LeaveCategory, LeaveBalance, Group } from '../../types'

type Tab = 'balance' | 'category'

export default function LeavePage() {
  const [tab, setTab] = useState<Tab>('balance')

  const [balances, setBalances]   = useState<(LeaveBalance & { employee: any; leave_category: LeaveCategory })[]>([])
  const [groups, setGroups]       = useState<Group[]>([])
  const [groupFilter, setGroupFilter] = useState('all')
  const [yearFilter, setYearFilter]   = useState(String(new Date().getFullYear()))
  const [loadingBal, setLoadingBal] = useState(false)
  const [pageBal, setPageBal]     = useState(1)
  const [pageSizeBal, setPageSizeBal] = useState(10)
  const [totalBal, setTotalBal]   = useState(0)

  // Generate balance state
  const [genModal, setGenModal]     = useState(false)
  const [genYear, setGenYear]       = useState(String(new Date().getFullYear()))
  const [genGroup, setGenGroup]     = useState('all')
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult]   = useState<{ created: number; skipped: number; error?: string } | null>(null)

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

  const [downloading, setDownloading] = useState(false)

  const handleDownloadBalance = async () => {
    setDownloading(true)
    try {
      let q = supabase
        .from('leave_balances')
        .select('*, employee:employees(employee_code,full_name,group:groups(name)), leave_category:leave_categories(leave_name,limit_per_year)')
        .order('employee_id')
      if (groupFilter !== 'all') q = q.eq('employees.group_id', groupFilter)
      const { data } = await q

      exportCsv(`leave-balance`, [
        'Kode', 'Nama', 'Grup', 'Jenis Cuti', 'Limit/Tahun', 'Terpakai (Tahunan)', 'Terpakai (Lainnya)',
      ], (data || []).map((b: any) => [
        b.employee?.employee_code ?? '',
        b.employee?.full_name ?? '',
        b.employee?.group?.name ?? '',
        b.leave_category?.leave_name ?? '',
        b.leave_category?.limit_per_year ?? '∞',
        b.annual_taken ?? 0,
        b.other_taken ?? 0,
      ]))
    } finally {
      setDownloading(false)
    }
  }

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
        leave_category:leave_categories(id,leave_name,leave_type,limit_per_year)
      `, { count: 'exact' })
      .order('employee_id')

    if (yearFilter) q = q.eq('year', parseInt(yearFilter))
    if (groupFilter !== 'all') q = q.eq('employees.group_id', groupFilter)

    const { data, count } = await q.range((pageBal - 1) * pageSizeBal, pageBal * pageSizeBal - 1)
    setBalances((data || []) as any)
    setTotalBal(count || 0)
    setLoadingBal(false)
  }, [groupFilter, yearFilter, pageBal, pageSizeBal])

  const handleGenerate = async () => {
    setGenerating(true)
    setGenResult(null)
    try {
      // Fetch active employees
      let empQuery = supabase.from('employees').select('id').eq('is_active', true)
      if (genGroup !== 'all') empQuery = empQuery.eq('group_id', genGroup)
      const { data: employees, error: empErr } = await empQuery
      if (empErr) throw empErr

      // Fetch all leave categories
      const { data: cats, error: catErr } = await supabase.from('leave_categories').select('id')
      if (catErr) throw catErr

      if (!employees?.length) { setGenResult({ created: 0, skipped: 0, error: 'Tidak ada karyawan aktif' }); return }
      if (!cats?.length) { setGenResult({ created: 0, skipped: 0, error: 'Belum ada kategori cuti' }); return }

      // Build all employee × category pairs
      const year = parseInt(genYear)
      const records = employees.flatMap(emp =>
        cats.map(cat => ({
          employee_id: emp.id,
          leave_category_id: cat.id,
          year,
          annual_taken: 0,
          other_taken: 0,
        }))
      )

      // Upsert with ignoreDuplicates so existing taken counts are NOT overwritten
      const { error } = await supabase
        .from('leave_balances')
        .upsert(records, { onConflict: 'employee_id,leave_category_id,year', ignoreDuplicates: true })
      if (error) throw error

      // Count how many were actually new (rough estimate via total - existing)
      const { count: existing } = await supabase
        .from('leave_balances')
        .select('id', { count: 'exact', head: true })
        .eq('year', year)

      const total = records.length
      const created = Math.max(0, total - (existing || total))
      setGenResult({ created, skipped: total - created })
      fetchBalances()
    } catch (err: any) {
      setGenResult({ created: 0, skipped: 0, error: err.message })
    } finally {
      setGenerating(false)
    }
  }

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
        {/* Tab bar — tabs only */}
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
        </div>

        {/* ── Balance Tab ── */}
        {tab === 'balance' && (
          <>
            {/* Toolbar: filters left, actions right */}
            <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-3 border-b border-gray-100">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="form-label">Year</label>
                  <select className="form-input w-28" value={yearFilter}
                    onChange={e => { setYearFilter(e.target.value); setPageBal(1) }}>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Group</label>
                  <select className="form-input w-44" value={groupFilter}
                    onChange={e => { setGroupFilter(e.target.value); setPageBal(1) }}>
                    <option value="all">All Group</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setGenYear(String(new Date().getFullYear())); setGenGroup('all'); setGenResult(null); setGenModal(true) }}
                  className="btn-secondary">
                  <RefreshCw size={14} /> Generate Balance
                </button>
                <button onClick={handleDownloadBalance} disabled={downloading} className="btn-secondary">
                  {downloading ? <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Download size={14} />}
                  {downloading ? 'Mengunduh...' : 'Download'}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Full Name</th>
                    <th>Group</th>
                    <th>Leave Category</th>
                    <th className="text-center">Annual Taken</th>
                    <th className="text-center">Other Taken</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingBal ? (
                    <tr><td colSpan={7} className="text-center py-16"><Spinner className="mx-auto" /></td></tr>
                  ) : balances.length === 0 ? (
                    <EmptyState message="Belum ada data saldo cuti. Klik Generate Balance untuk membuat." />
                  ) : (
                    balances.map(b => (
                      <tr key={b.id} className="hover:bg-gray-50/60">
                        <td className="font-mono text-xs text-gray-500">{b.employee?.employee_code}</td>
                        <td className="font-medium text-gray-900">{b.employee?.full_name}</td>
                        <td><span className="badge badge-gray">{b.employee?.group?.name || '-'}</span></td>
                        <td className="text-sm text-gray-700">{b.leave_category?.leave_name}</td>
                        <td className="text-center">
                          <span className="font-semibold text-gray-900">{b.annual_taken}</span>
                          <span className="text-gray-400 text-xs"> / {b.leave_category?.limit_per_year ?? '∞'}</span>
                        </td>
                        <td className="text-center font-semibold text-gray-900">{b.other_taken}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button className="btn-icon text-blue-500" title="Detail"><FileText size={14} /></button>
                            <button className="btn-icon text-gray-400" title="Edit"><Edit2 size={14} /></button>
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

        {/* ── Category Tab ── */}
        {tab === 'category' && (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-end px-4 py-3 border-b border-gray-100">
              <button onClick={openAddCat} className="btn-primary">
                <Plus size={14} /> Add Leave Category
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Leave Type</th>
                    <th>Leave Name</th>
                    <th>Limit / Year</th>
                    <th>Amount per Taken</th>
                    <th>Approval Level</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingCat ? (
                    <tr><td colSpan={6} className="text-center py-16"><Spinner className="mx-auto" /></td></tr>
                  ) : categories.length === 0 ? (
                    <EmptyState message="Belum ada kategori cuti" />
                  ) : (
                    categories.map(cat => (
                      <tr key={cat.id} className="hover:bg-gray-50/60">
                        <td>
                          <span className={`badge ${cat.leave_type === 'annual' ? 'badge-green' : cat.leave_type === 'sick' ? 'badge-yellow' : 'badge-blue'}`}>
                            {cat.leave_type === 'sick' ? 'Sick Leave' : cat.leave_type === 'annual' ? 'Annual Leave' : cat.leave_type === 'special' ? 'Special Leave' : 'Other'}
                          </span>
                        </td>
                        <td className="font-medium text-gray-900">{cat.leave_name}</td>
                        <td className="text-gray-600">{cat.limit_per_year ? `${cat.limit_per_year} hari` : <span className="text-gray-400">Tidak terbatas</span>}</td>
                        <td className="text-gray-600">{cat.amount_per_taken === 'as_requested' ? 'As Requested' : 'Fixed'}</td>
                        <td className="text-center text-gray-600">{cat.approval_level}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEditCat(cat)} className="btn-icon text-blue-500"><Edit2 size={14} /></button>
                            <button onClick={() => setDeleteCat(cat)} className="btn-icon text-red-400"><span className="text-sm leading-none">✕</span></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Generate Balance Modal */}
      <Modal open={genModal} onClose={() => setGenModal(false)} title="Generate Leave Balance" width="max-w-sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Generate akan membuat saldo cuti baru untuk semua karyawan aktif × semua kategori cuti pada tahun yang dipilih.
            Saldo yang sudah ada <strong>tidak akan ditimpa</strong>.
          </p>

          {genResult ? (
            <div className="space-y-2">
              {genResult.error ? (
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl">
                  <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{genResult.error}</p>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 bg-green-50 rounded-xl">
                  <CheckCircle size={16} className="text-green-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-green-700">
                    <p className="font-medium">Generate berhasil!</p>
                    <p>{genResult.created} saldo baru dibuat · {genResult.skipped} sudah ada (dilewati)</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="form-label">Tahun *</label>
                <select className="form-input" value={genYear} onChange={e => setGenYear(e.target.value)}>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + 1 - i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Group (opsional)</label>
                <select className="form-input" value={genGroup} onChange={e => setGenGroup(e.target.value)}>
                  <option value="all">Semua Group</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 justify-end mt-5 pt-4 border-t border-gray-100">
          <button onClick={() => setGenModal(false)} className="btn-secondary">
            {genResult ? 'Tutup' : 'Batal'}
          </button>
          {!genResult && (
            <button onClick={handleGenerate} disabled={generating} className="btn-primary">
              {generating ? <Spinner className="w-4 h-4" /> : <RefreshCw size={14} />}
              {generating ? 'Generating...' : 'Generate'}
            </button>
          )}
        </div>
      </Modal>

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
