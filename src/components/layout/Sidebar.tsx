import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard, ClipboardList, BarChart2, Calendar,
  Users, Layers, GitBranch, Tag, MapPin, Building2,
  Clock, CheckSquare, Umbrella, Newspaper, Activity,
  ChevronDown, ChevronRight, Map
} from 'lucide-react'

interface NavChild {
  label: string
  path: string
}

interface NavSection {
  section?: string
  items: NavItemDef[]
}

interface NavItemDef {
  label: string
  path: string
  icon: React.ElementType
  children?: NavChild[]
}

const navigation: NavSection[] = [
  {
    section: 'Menu',
    items: [
      { label: 'Summary Report', path: '/summary-report', icon: LayoutDashboard },
      {
        label: 'Attendance', path: '/attendance', icon: ClipboardList,
        children: [
          { label: 'Location Map', path: '/attendance/location-map' },
          { label: 'Issue Attendance', path: '/attendance/issue' },
        ]
      },
      {
        label: 'Report', path: '/report', icon: BarChart2,
        children: [
          { label: 'User Report', path: '/report/user' },
          { label: 'Monthly Report', path: '/report/monthly' },
          { label: 'Activity Report', path: '/report/activity' },
          { label: 'User Summary', path: '/report/user-summary' },
        ]
      },
    ]
  },
  {
    section: 'Manage',
    items: [
      { label: 'Shifting', path: '/manage/shifting', icon: Clock },
      { label: 'Approval', path: '/manage/approval', icon: CheckSquare },
      { label: 'Leave', path: '/manage/leave', icon: Umbrella },
      { label: 'Calendar', path: '/manage/calendar', icon: Calendar },
      { label: 'News Feed', path: '/manage/news-feed', icon: Newspaper },
      { label: 'Audit Trail', path: '/manage/audit-trail', icon: Activity },
    ]
  },
  {
    section: 'Settings',
    items: [
      { label: 'Employee', path: '/settings/employee', icon: Users },
      { label: 'Groups', path: '/settings/groups', icon: Layers },
      { label: 'Hierarchy', path: '/settings/hierarchy', icon: GitBranch },
      { label: 'Category', path: '/settings/category', icon: Tag },
      { label: 'Zones', path: '/settings/zones', icon: MapPin },
      { label: 'Company', path: '/settings/company', icon: Building2 },
    ]
  }
]

interface SidebarProps {
  collapsed: boolean
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const location = useLocation()
  const [openMenus, setOpenMenus] = useState<string[]>(['/attendance', '/report'])

  const toggleMenu = (path: string) => {
    setOpenMenus(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    )
  }

  const isActive = (path: string) => location.pathname === path
  const isParentActive = (item: NavItemDef) => {
    if (isActive(item.path)) return true
    return item.children?.some(c => location.pathname.startsWith(c.path)) ?? false
  }

  return (
    <aside className={clsx(
      'fixed left-0 top-0 h-full bg-white border-r border-gray-100 flex flex-col z-30 transition-all duration-300 shadow-sidebar',
      collapsed ? 'w-16' : 'w-56'
    )}>
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Map className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-gray-900 leading-tight truncate">TEFA Presensi</p>
              <p className="text-[10px] text-gray-400 leading-tight">v1.0</p>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navigation.map((section) => (
          <div key={section.section} className="mb-4">
            {section.section && !collapsed && (
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1.5">
                {section.section}
              </p>
            )}

            {section.items.map((item) => {
              const Icon = item.icon
              const hasChildren = item.children && item.children.length > 0
              const isOpen = openMenus.includes(item.path)
              const active = isParentActive(item)

              if (hasChildren) {
                return (
                  <div key={item.path}>
                    <button
                      onClick={() => toggleMenu(item.path)}
                      className={clsx('nav-item w-full', active && !isOpen && 'active')}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left">{item.label}</span>
                          {isOpen
                            ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                            : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                          }
                        </>
                      )}
                    </button>

                    {/* Children */}
                    {isOpen && !collapsed && (
                      <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-100 pl-3">
                        {item.children!.map(child => (
                          <NavLink
                            key={child.path}
                            to={child.path}
                            className={({ isActive }) => clsx(
                              'block px-2 py-2 rounded-lg text-sm transition-all duration-150',
                              isActive
                                ? 'text-blue-600 font-medium bg-blue-50'
                                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                            )}
                          >
                            {child.label}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) => clsx('nav-item', isActive && 'active')}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
