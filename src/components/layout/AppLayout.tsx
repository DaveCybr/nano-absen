import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { clsx } from 'clsx'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar collapsed={collapsed} />
      <Topbar collapsed={collapsed} onToggle={() => setCollapsed(p => !p)} />

      {/* Main content */}
      <main className={clsx(
        'pt-14 min-h-screen transition-all duration-300',
        collapsed ? 'ml-16' : 'ml-56'
      )}>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
