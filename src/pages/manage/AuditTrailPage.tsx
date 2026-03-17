import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Search } from 'lucide-react'
import { Spinner, EmptyState, Pagination } from '../../components/ui'
import clsx from 'clsx'

interface AuditRow {
  id: string
  action: string
  module: string
  description: string | null
  old_data: any
  new_data: any
  ip_address: string | null
  created_at: string
  employee: { full_name: string; employee_code: string } | null
}

export default function AuditTrailPage() {
  const [rows, setRows]         = useState<AuditRow[]>([])
  const [loading, setLoading]   = useState(false)
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal]       = useState(0)
  const [moduleFilter, setModuleFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [search, setSearch]     = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const modules = ['employees', 'attendances', 'leave_requests', 'groups', 'zones', 'companies']

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('audit_logs')
      .select(`
        *,
        employee:employees(full_name, employee_code)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    if (moduleFilter !== 'all') q = q.eq('module', moduleFilter)
    if (actionFilter !== 'all') q = q.eq('action', actionFilter)

    const { data, count } = await q.range((page - 1) * pageSize, page * pageSize - 1)
    setRows((data || []) as AuditRow[])
    setTotal(count || 0)
    setLoading(false)
  }, [moduleFilter, actionFilter, page, pageSize])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const actionColor: Record<string, string> = {
    INSERT: 'badge-green',
    UPDATE: 'badge-blue',
    DELETE: 'badge-red',
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })

  return (
    <div>
      <h1 className="page-title mb-6">Audit Trail</h1>

      <div className="card">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 p-4 border-b border-gray-100">
          <div>
            <label className="form-label">Module</label>
            <select className="form-input w-40" value={moduleFilter}
              onChange={e => { setModuleFilter(e.target.value); setPage(1) }}>
              <option value="all">All Module</option>
              {modules.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Action</label>
            <select className="form-input w-32" value={actionFilter}
              onChange={e => { setActionFilter(e.target.value); setPage(1) }}>
              <option value="all">All Action</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="form-input pl-8 w-48" placeholder="Cari..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Module</th>
                <th>Description</th>
                <th>IP Address</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-16"><Spinner className="mx-auto" /></td></tr>
              ) : rows.length === 0 ? (
                <EmptyState message="Belum ada log audit" />
              ) : (
                rows.map(row => (
                  <>
                    <tr key={row.id} className="hover:bg-gray-50/60">
                      <td className="text-xs text-gray-500 whitespace-nowrap font-mono">
                        {formatDate(row.created_at)}
                      </td>
                      <td>
                        {row.employee ? (
                          <div>
                            <p className="font-medium text-sm">{row.employee.full_name}</p>
                            <p className="text-xs text-gray-400">#{row.employee.employee_code}</p>
                          </div>
                        ) : <span className="text-gray-400 text-sm">System</span>}
                      </td>
                      <td>
                        <span className={clsx('badge text-xs font-mono', actionColor[row.action] || 'badge-gray')}>
                          {row.action}
                        </span>
                      </td>
                      <td className="text-sm font-mono text-gray-600">{row.module}</td>
                      <td className="text-sm text-gray-600 max-w-xs">
                        <p className="truncate">{row.description || '-'}</p>
                      </td>
                      <td className="text-xs font-mono text-gray-500">{row.ip_address || '-'}</td>
                      <td>
                        {(row.old_data || row.new_data) && (
                          <button
                            onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                            className="text-xs text-blue-500 hover:underline"
                          >
                            {expandedId === row.id ? 'Tutup' : 'Lihat'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === row.id && (
                      <tr key={`${row.id}-detail`}>
                        <td colSpan={7} className="bg-gray-50 px-4 py-3">
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            {row.old_data && (
                              <div>
                                <p className="font-semibold text-red-600 mb-1">Before:</p>
                                <pre className="bg-red-50 border border-red-100 rounded-lg p-2 overflow-auto max-h-32 text-gray-700">
                                  {JSON.stringify(row.old_data, null, 2)}
                                </pre>
                              </div>
                            )}
                            {row.new_data && (
                              <div>
                                <p className="font-semibold text-green-600 mb-1">After:</p>
                                <pre className="bg-green-50 border border-green-100 rounded-lg p-2 overflow-auto max-h-32 text-gray-700">
                                  {JSON.stringify(row.new_data, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={setPageSize} />
      </div>
    </div>
  )
}
