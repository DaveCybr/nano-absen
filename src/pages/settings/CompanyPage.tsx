import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Edit2, Save } from 'lucide-react'
import { Spinner } from '../../components/ui'
import type { Company } from '../../types'

export default function CompanyPage() {
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    name: '', address: '', phone: '', email: '',
    timezone: 'Asia/Jakarta', cutoff_date: '1', pic_email: '',
  })

  useEffect(() => {
    supabase.from('companies').select('*').single().then(({ data }) => {
      if (data) {
        setCompany(data as Company)
        setForm({
          name:        data.name,
          address:     data.address || '',
          phone:       data.phone || '',
          email:       data.email || '',
          timezone:    data.timezone,
          cutoff_date: String(data.cutoff_date),
          pic_email:   data.pic_email || '',
        })
      }
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Nama perusahaan wajib diisi'); return }
    setError('')
    setSaving(true)

    const { error: err } = await supabase
      .from('companies')
      .update({
        name:        form.name,
        address:     form.address || null,
        phone:       form.phone || null,
        email:       form.email || null,
        timezone:    form.timezone,
        cutoff_date: parseInt(form.cutoff_date),
        pic_email:   form.pic_email || null,
        updated_at:  new Date().toISOString(),
      })
      .eq('id', company!.id)

    if (err) {
      setError(err.message)
    } else {
      setSuccess('Data perusahaan berhasil disimpan')
      setEditing(false)
      setTimeout(() => setSuccess(''), 3000)
    }
    setSaving(false)
  }

  const setField = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }))

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div>
      <h1 className="page-title mb-6">Company</h1>

      <div className="card p-6 mb-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">Company Data</h2>
          {editing ? (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="btn-secondary">Batal</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? <Spinner className="w-4 h-4" /> : <Save size={14} />} Simpan
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-primary">
              <Edit2 size={14} /> Edit Data
            </button>
          )}
        </div>

        {error   && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>}

        <div className="grid grid-cols-2 gap-6">
          <div className="col-span-2 flex items-center gap-4">
            <div className="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center border border-gray-200">
              <span className="text-2xl font-bold text-gray-400">{form.name.charAt(0)}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Company Logo</p>
              <p className="text-xs text-gray-400 mt-1">Upload logo perusahaan</p>
              {editing && <button className="btn-secondary mt-2 text-xs py-1">Upload Logo</button>}
            </div>
          </div>

          <div>
            <label className="form-label">Company Name</label>
            {editing
              ? <input className="form-input" value={form.name} onChange={e => setField('name', e.target.value)} />
              : <p className="text-sm font-medium text-gray-900">{company?.name}</p>}
          </div>
          <div>
            <label className="form-label">Company Phone</label>
            {editing
              ? <input className="form-input" value={form.phone} onChange={e => setField('phone', e.target.value)} />
              : <p className="text-sm text-gray-700">{company?.phone || '-'}</p>}
          </div>
          <div>
            <label className="form-label">Company ID</label>
            <p className="text-sm font-mono text-gray-600">{company?.company_slug}</p>
          </div>
          <div>
            <label className="form-label">Cut-off Date</label>
            {editing
              ? <input className="form-input" type="number" min={1} max={28} value={form.cutoff_date}
                  onChange={e => setField('cutoff_date', e.target.value)} />
              : <p className="text-sm text-gray-700">{company?.cutoff_date}</p>}
          </div>
          <div>
            <label className="form-label">Company Email</label>
            {editing
              ? <input className="form-input" type="email" value={form.email} onChange={e => setField('email', e.target.value)} />
              : <p className="text-sm text-gray-700">{company?.email || '-'}</p>}
          </div>
          <div>
            <label className="form-label">Timezone</label>
            {editing
              ? <select className="form-input" value={form.timezone} onChange={e => setField('timezone', e.target.value)}>
                  <option value="Asia/Jakarta">WIB (Asia/Jakarta)</option>
                  <option value="Asia/Makassar">WITA (Asia/Makassar)</option>
                  <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
                </select>
              : <p className="text-sm text-gray-700">{company?.timezone}</p>}
          </div>
          <div className="col-span-2">
            <label className="form-label">Company Address</label>
            {editing
              ? <input className="form-input" value={form.address} onChange={e => setField('address', e.target.value)} />
              : <p className="text-sm text-gray-700">{company?.address || '-'}</p>}
          </div>
        </div>
      </div>

      {/* Plan status */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Plan Status: <span className="text-blue-600">{company?.plan_type || 'umkm'}</span>
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <label className="form-label">Onboarded Period</label>
            <p className="text-gray-700">
              {company?.plan_start || '-'} — {company?.plan_end || '-'}
            </p>
          </div>
          <div>
            <label className="form-label">Days Remaining</label>
            <p className="text-gray-700">
              {company?.plan_end
                ? Math.max(0, Math.ceil((new Date(company.plan_end).getTime() - Date.now()) / 86400000))
                : '-'} days
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
