import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, Briefcase, TrendingUp, Target, Bell, Settings, LogOut, Eye,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { useGrant } from '@/features/auth/GrantContext'
import OwnerPicker from '@/features/auth/OwnerPicker'
import { Button } from '@/components/ui/button'
import WealthLensLogo from '@/components/layout/WealthLensLogo'
import { cn } from '@/lib/utils'

const ALL_NAV = [
  { to: '/',           label: 'Dashboard',  icon: LayoutDashboard, page: 'dashboard'  },
  { to: '/portfolios', label: 'Portfolios', icon: Briefcase,        page: 'portfolios' },
  { to: '/scenarios',  label: 'Scenarios',  icon: TrendingUp,       page: 'scenarios'  },
  { to: '/goals',      label: 'Goals',      icon: Target,           page: 'goals'      },
  { to: '/alerts',     label: 'Alerts',     icon: Bell,             page: null         },
  { to: '/settings',   label: 'Settings',   icon: Settings,         page: null         },
]

export default function AppLayout() {
  const { user, signOut } = useAuth()
  const { isViewer, grantedPages, grants, selectedGrant, loading } = useGrant()

  // Multiple owners, none selected — show picker before entering the app
  if (!loading && isViewer && grants.length > 1 && !selectedGrant) {
    return <OwnerPicker />
  }

  const visibleNav = ALL_NAV.filter(item =>
    !isViewer || item.page === null || grantedPages.includes(item.page as never)
  )

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r bg-sidebar">
        {/* Logo */}
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <WealthLensLogo />
        </div>

        {/* Viewer mode banner */}
        {isViewer && (
          <div className="mx-3 mt-3 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            <Eye className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Read-only view</span>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-3">
          {visibleNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-primary/20 text-sidebar-primary font-semibold'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t p-3">
          <div className="mb-2 truncate px-3 text-xs text-muted-foreground">
            {user?.email}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 text-sidebar-foreground"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
