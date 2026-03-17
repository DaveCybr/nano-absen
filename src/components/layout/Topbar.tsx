import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, ChevronDown, LogOut, User, Settings } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { clsx } from 'clsx'

interface TopbarProps {
  collapsed: boolean
  onToggle: () => void
}

export default function Topbar({ collapsed, onToggle }: TopbarProps) {
  const { employee, user, signOut } = useAuth()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth/login', { replace: true })
  }

  const accessLabel: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    hr: 'HR',
    staff: 'Staff',
  }

  const avatar = user?.user_metadata?.avatar_url
  const displayName = employee?.full_name || user?.user_metadata?.full_name || 'User'
  const role = employee?.access_type ? accessLabel[employee.access_type] : 'HR'

  return (
    <header className={clsx(
      'fixed top-0 right-0 h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 z-20 transition-all duration-300',
      collapsed ? 'left-16' : 'left-56'
    )}>
      {/* Left: toggle + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* Right: company badge + user */}
      <div className="flex items-center gap-3">
        {/* Company plan badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-lg">
          <span className="text-xs font-medium text-blue-700">Umkm</span>
          <span className="text-xs text-blue-400">·</span>
          <span className="text-xs text-blue-500">246 days left</span>
        </div>

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(p => !p)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-gray-50 transition-colors"
          >
            {avatar ? (
              <img src={avatar} alt={displayName} className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-gray-900 leading-tight">{role}</p>
            </div>
            <ChevronDown className={clsx('w-3.5 h-3.5 text-gray-400 transition-transform', dropdownOpen && 'rotate-180')} />
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-dropdown border border-gray-100 py-1.5 z-50">
              {/* User info */}
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                <span className="inline-block mt-1.5 badge badge-blue">{role}</span>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <button
                  onClick={() => { navigate('/settings/employee'); setDropdownOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <User className="w-4 h-4 text-gray-400" />
                  Profil Saya
                </button>
                <button
                  onClick={() => { navigate('/settings/company'); setDropdownOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Settings className="w-4 h-4 text-gray-400" />
                  Pengaturan
                </button>
              </div>

              <div className="border-t border-gray-50 pt-1">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Keluar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
