import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Users,
  MapPin,
  Building2,
  ChevronDown,
  ChevronRight,
  FileText,
  Calendar,
  CheckSquare,
  Newspaper,
  Shield,
  Layers,
  ClipboardList,
  Settings,
  Clock,
  Activity,
} from "lucide-react";
import clsx from "clsx";

type NavChild = { label: string; path: string };
type NavSection = {
  label?: string;
  items: {
    id: string;
    label: string;
    icon: React.ReactNode;
    path?: string;
    children?: NavChild[];
  }[];
};

const navigation: NavSection[] = [
  {
    label: "Menu",
    items: [
      {
        id: "summary",
        label: "Summary Report",
        icon: <BarChart3 size={16} />,
        path: "/summary-report",
      },
      {
        id: "attendance",
        label: "Attendance",
        icon: <CheckSquare size={16} />,
        children: [
          { label: "Location Map", path: "/attendance/location-map" },
          { label: "Issue Attendance", path: "/attendance/issue" },
        ],
      },
      {
        id: "report",
        label: "Report",
        icon: <FileText size={16} />,
        children: [
          { label: "User Report", path: "/report/user" },
          { label: "Monthly Report", path: "/report/monthly" },
          { label: "Activity Report", path: "/report/activity" },
          { label: "User Summary", path: "/report/user-summary" },
        ],
      },
    ],
  },
  {
    label: "Manage",
    items: [
      {
        id: "shifting",
        label: "Shifting",
        icon: <Clock size={16} />,
        path: "/manage/shifting",
      },
      {
        id: "approval",
        label: "Approval",
        icon: <ClipboardList size={16} />,
        path: "/manage/approval",
      },
      {
        id: "leave",
        label: "Leave",
        icon: <Calendar size={16} />,
        path: "/manage/leave",
      },
      {
        id: "calendar",
        label: "Calendar",
        icon: <Calendar size={16} />,
        path: "/manage/calendar",
      },
      {
        id: "newsfeed",
        label: "News Feed",
        icon: <Newspaper size={16} />,
        path: "/manage/news-feed",
      },
      {
        id: "audit",
        label: "Audit Trail",
        icon: <Activity size={16} />,
        path: "/manage/audit-trail",
      },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        id: "employee",
        label: "Employee",
        icon: <Users size={16} />,
        path: "/settings/employee",
      },
      {
        id: "groups",
        label: "Groups",
        icon: <Layers size={16} />,
        path: "/settings/groups",
      },
      {
        id: "hierarchy",
        label: "Hierarchy",
        icon: <Settings size={16} />,
        path: "/settings/hierarchy",
      },
      {
        id: "category",
        label: "Category",
        icon: <Shield size={16} />,
        path: "/settings/category",
      },
      {
        id: "zones",
        label: "Zones",
        icon: <MapPin size={16} />,
        path: "/settings/zones",
      },
      {
        id: "company",
        label: "Company",
        icon: <Building2 size={16} />,
        path: "/settings/company",
      },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    attendance: true,
    report: false,
  });

  const toggleMenu = (id: string) =>
    setOpenMenus((prev) => ({ ...prev, [id]: !prev[id] }));

  const isActive = (path: string) => location.pathname === path;
  const isChildActive = (children?: NavChild[]) =>
    children?.some((c) => location.pathname === c.path);

  return (
    <aside className="w-[240px] shrink-0 h-full flex flex-col bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-gray-100 shrink-0">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">N</span>
        </div>
        <div>
          <div className="font-semibold text-gray-900 text-sm leading-tight">
            nano.HR
          </div>
          <div className="text-[10px] text-gray-400 leading-tight">v1.0.0</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll py-3">
        {navigation.map((section, si) => (
          <div key={si} className="mb-1">
            {section.label && (
              <div className="section-label">{section.label}</div>
            )}
            {section.items.map((item) => (
              <div key={item.id}>
                {item.children ? (
                  <>
                    <button
                      onClick={() => toggleMenu(item.id)}
                      className={clsx(
                        "w-full flex items-center gap-2.5 px-3 py-2 mx-2 rounded-lg text-sm font-medium transition-colors duration-150",
                        isChildActive(item.children)
                          ? "text-blue-700 bg-blue-50"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-800",
                      )}
                      style={{ width: "calc(100% - 16px)" }}
                    >
                      <span
                        className={
                          isChildActive(item.children)
                            ? "text-blue-600"
                            : "text-gray-400"
                        }
                      >
                        {item.icon}
                      </span>
                      <span className="flex-1 text-left">{item.label}</span>
                      {openMenus[item.id] ? (
                        <ChevronDown size={14} className="text-gray-400" />
                      ) : (
                        <ChevronRight size={14} className="text-gray-400" />
                      )}
                    </button>
                    {openMenus[item.id] && (
                      <div className="mt-0.5">
                        {item.children.map((child) => (
                          <button
                            key={child.path}
                            onClick={() => navigate(child.path)}
                            style={{ width: "calc(100% - 16px)" }}
                            className={clsx(
                              "w-full text-left",
                              isActive(child.path)
                                ? "nav-sub-item-active"
                                : "nav-sub-item",
                            )}
                          >
                            {child.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => item.path && navigate(item.path)}
                    style={{ width: "calc(100% - 16px)" }}
                    className={clsx(
                      "w-full text-left",
                      item.path && isActive(item.path)
                        ? "nav-item-active"
                        : "nav-item",
                    )}
                  >
                    <span
                      className={
                        item.path && isActive(item.path)
                          ? "text-white"
                          : "text-gray-400"
                      }
                    >
                      {item.icon}
                    </span>
                    {item.label}
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
