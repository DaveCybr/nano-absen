/**
 * Export data to a CSV file and trigger browser download.
 * Prepends UTF-8 BOM so Excel opens Indonesian characters correctly.
 */
export function exportCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
) {
  const escape = (v: string | number | null | undefined): string => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const csv = [headers, ...rows].map(row => row.map(escape).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : filename + '.csv'
  a.click()
  URL.revokeObjectURL(url)
}

/** Format timestamp to HH:MM for CSV */
export function csvTime(ts: string | null): string {
  if (!ts) return '-'
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

/** Format minutes to "Xh Ym" for CSV */
export function csvMins(m: number): string {
  if (!m) return '-'
  const h = Math.floor(m / 60)
  const min = m % 60
  if (h === 0) return `${min}m`
  return min === 0 ? `${h}h` : `${h}h ${min}m`
}
