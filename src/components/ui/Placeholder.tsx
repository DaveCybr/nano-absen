import { Construction } from 'lucide-react'

interface PlaceholderProps {
  title: string
  description?: string
}

export default function Placeholder({ title, description }: PlaceholderProps) {
  return (
    <div>
      <h1 className="page-header">{title}</h1>
      <div className="card flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 bg-yellow-50 rounded-2xl flex items-center justify-center mb-4">
          <Construction className="w-7 h-7 text-yellow-500" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Segera Hadir</h3>
        <p className="text-sm text-gray-500">
          {description || `Halaman ${title} sedang dalam pengembangan.`}
        </p>
      </div>
    </div>
  )
}
