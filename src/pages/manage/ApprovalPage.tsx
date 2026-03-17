import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { CheckCircle, XCircle, Clock } from 'lucide-react'
import { Spinner, EmptyState, Pagination, Modal } from '../../components/ui'
import { useAuth } from '../../hooks/useAuth'
import clsx from 'clsx'

type ApprovalTab = 'leave' | 'overtime' | 'correction'

interface LeaveRequestRow {
  id: string
  employee: { full_name: string; employee_code: string; group: { name: string } | null }
  leave_category: { leave_name: string; leave_type: string }
  start_date: string
  end_date: string
  total_days: number
  reason: string | null
  status: string
  created_at: string
}

export default function ApprovalPage() {
  const { employee: currentEmployee } = useAuth()
  const [tab, setTab]               = useState<ApprovalTab>('leave')
  const [leaveRows, setLeaveRows]   = useState<LeaveRequestRow[]>([])
  const [loading, setLoading]       = useState(false)
  const [page, setPage]             = useState(1)
  const [pageSize, setPageSize]     = useState(10)
  const [total, setTotal]           = useState(0)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [detail, setDetail]         = useState<LeaveRequestRow | null>(null)
  const [processing, setProcessing] = useState(false)

  const fetchLeave = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('leave_requests')
      .select(`
        *,
        employee:employees(full_name, employee_code, group:groups(name)),
        leave_category:leave_categories(leave_name, leave_type)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    if (statusFilter !== 'all') q = q.eq('status', statusFilter)

    const { data, count } = await q.range((page - 1) * pageSize, page * pageSize - 1)
    setLeaveRows((data || []) as LeaveRequestRow[])
    setTotal(count || 0)
    setLoading(false)
  }, [statusFilter, page, pageSize])

  useEffect(() => { fetchLeave() }, [fetchLeave])

  const handleApprove = async (id: string) => {
    setProcessing(true)
    await supabase.from('leave_requests').update({
      status: 'approved',
      approved_by: currentEmployee?.id,
      approved_at: new Date().toISOString(),
    }).eq('id', id)
    setDetail(null)
    fetchLeave()
    setProcessing(false)
  }

  const handleReject = async (id: string) => {
    setProcessing(true)
    await supabase.from('leave_requests').update({
      status: 'rejected',
      approved_by: currentEmployee?.id,
      approved_at: new Date().toISOString(),
    }).eq('id', id)
    setDetail(null)
    fetchLeave()
    setProcessing(false)
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending:   'badge-yellow',
      approved:  'badge-green',
      rejected:  'badge-red',
      cancelled: 'badge-gray',
    }
    const label: Record<string, string> = {
      pending: 'Pending', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled'
    }
    return <span className={clsx('badge', map[status] || 'badge-gray')}>{label[status] || status}</span>
  }

  return (
    <div>
      <h1 className="page-title mb-6">Approval</h1>

      <div className="card">
        <div className="flex border-b border-gray-100 px-4 gap-1">
          {([
            { id: 'leave' as ApprovalTab,      label: 'Leave Request' },
            { id: 'overtime' as ApprovalTab,   label: 'Overtime Request' },
            { id: 'correction' as ApprovalTab, label: 'Attendance Correction' },
          ]).map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setPage(1) }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 p-4 border-b border-gray-50">
          <div>
            <label className="form-label">Status</label>
            <select className="form-input w-36" value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
              <option value="all">Semua</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {tab === 'leave' && (
          <>
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Leave Type</th>
                    <th>Period</th>
                    <th>Total Days</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="text-center py-16"><Spinner className="mx-auto" /></td></tr>
                  ) : leaveRows.length === 0 ? (
                    <EmptyState message="Tidak ada pengajuan cuti" />
                  ) : (
                    leaveRows.map(row => (
                      <tr key={row.id} className="hover:bg-gray-50/60">
                        <td>
                          <p className="font-medium text-gray-900">{row.employee?.full_name}</p>
                          <p className="text-xs text-gray-400">{row.employee?.group?.name || '-'}</p>
                        </td>
                        <td>
                          <span className={clsx('badge', row.leave_category?.leave_type === 'sick' ? 'badge-yellow' : 'badge-blue')}>
                            {row.leave_category?.leave_name}
                          </span>
                        </td>
                        <td className="text-sm text-gray-600">{row.start_date} s/d {row.end_date}</td>
                        <td className="text-center font-medium">{row.total_days} hari</td>
                        <td className="text-gray-600 text-sm max-w-xs truncate">{row.reason || '-'}</td>
                        <td>{statusBadge(row.status)}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            {row.status === 'pending' && (
                              <>
                                <button onClick={() => handleApprove(row.id)}
                                  className="btn-icon text-green-500" title="Approve">
                                  <CheckCircle size={16} />
                                </button>
                                <button onClick={() => handleReject(row.id)}
                                  className="btn-icon text-red-400" title="Reject">
                                  <XCircle size={16} />
                                </button>
                              </>
                            )}
                            <button onClick={() => setDetail(row)} className="btn-icon text-blue-500" title="Detail">
                              <Clock size={14} />
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
          </>
        )}

        {tab === 'overtime' && (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
            Belum ada pengajuan lembur
          </div>
        )}

        {tab === 'correction' && (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
            Belum ada pengajuan koreksi absensi
          </div>
        )}
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Detail Pengajuan Cuti" width="max-w-md">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Karyawan',   value: detail.employee?.full_name },
                { label: 'Divisi',     value: detail.employee?.group?.name || '-' },
                { label: 'Jenis Cuti', value: detail.leave_category?.leave_name },
                { label: 'Mulai',      value: detail.start_date },
                { label: 'Selesai',    value: detail.end_date },
                { label: 'Total Hari', value: `${detail.total_days} hari` },
                { label: 'Alasan',     value: detail.reason || '-' },
                { label: 'Status',     value: statusBadge(detail.status) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                  <div className="font-medium text-gray-900">{value}</div>
                </div>
              ))}
            </div>
            {detail.status === 'pending' && (
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button onClick={() => handleReject(detail.id)} disabled={processing}
                  className="btn-danger flex-1 justify-center">
                  <XCircle size={14} /> Tolak
                </button>
                <button onClick={() => handleApprove(detail.id)} disabled={processing}
                  className="btn-primary flex-1 justify-center" style={{ background: '#16a34a' }}>
                  <CheckCircle size={14} /> Setujui
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
