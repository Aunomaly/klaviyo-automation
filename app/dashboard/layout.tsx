'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  Tag,
  Send,
  Mail,
  GitBranch,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
  { name: 'Brands',    href: '/dashboard/brands',    icon: Tag,          exact: false },
  { name: 'Deploy',    href: '/dashboard/deploy',    icon: Send,         exact: false },
  { name: 'Templates', href: '/dashboard/templates', icon: Mail,         exact: false },
  { name: 'Flows',     href: '/dashboard/flows',     icon: GitBranch,    exact: false },
]

const EXPANDED_WIDTH = 240
const COLLAPSED_WIDTH = 56

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(true)

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  const w = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F4F5F7' }}>

      {/* Sidebar */}
      <aside
        className="fixed inset-y-0 left-0 flex flex-col z-20 overflow-hidden"
        style={{
          width: w,
          backgroundColor: '#FFFFFF',
          borderRight: '1px solid #E2E4E9',
          transition: 'width 180ms ease',
        }}
      >
        {/* Logo + collapse toggle — stacked when collapsed, row when expanded */}
        <div
          className="flex flex-shrink-0"
          style={{
            flexDirection: collapsed ? 'column' : 'row',
            alignItems: 'center',
            height: collapsed ? 'auto' : 64,
            paddingTop: collapsed ? 14 : 0,
            paddingBottom: collapsed ? 12 : 0,
            paddingLeft: collapsed ? 0 : 20,
            paddingRight: collapsed ? 0 : 12,
            gap: 8,
            borderBottom: '1px solid #E2E4E9',
            justifyContent: collapsed ? 'flex-start' : 'flex-start',
          }}
        >
          {/* Logo icon — always visible */}
          <div
            className="relative flex-shrink-0"
            style={{ width: 28, height: 28, backgroundColor: '#1A1918', borderRadius: 6 }}
          >
            <div
              className="absolute"
              style={{ width: 14, height: 14, backgroundColor: '#43ff47', borderRadius: '50%', top: 7, left: 2 }}
            />
          </div>

          {/* Brand name — hidden when collapsed */}
          {!collapsed && (
            <span
              className="flex-1 truncate"
              style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 15, color: '#1A1918' }}
            >
              Klaviyo Auto
            </span>
          )}

          {/* Expand/collapse toggle — below logo when collapsed, right side when expanded */}
          <button
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              marginLeft: collapsed ? 0 : 'auto',
              flexShrink: 0,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: collapsed ? '#1A1918' : '#9C9B99',
              padding: collapsed ? 8 : 4,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {collapsed
              ? <PanelLeftOpen style={{ width: 16, height: 16 }} />
              : <PanelLeftClose style={{ width: 16, height: 16 }} />}
          </button>
        </div>

        {/* Nav */}
        <nav
          className="flex flex-col flex-1 overflow-y-auto"
          style={{ padding: collapsed ? '12px 8px' : '12px 10px', gap: 2 }}
        >
          {navigation.map((item) => {
            const active = isActive(item.href, item.exact)
            return (
              <Link
                key={item.name}
                href={item.href}
                title={collapsed ? item.name : undefined}
                className="flex items-center rounded-lg transition-colors"
                style={{
                  height: 40,
                  gap: collapsed ? 0 : 10,
                  paddingLeft: collapsed ? 0 : 12,
                  paddingRight: collapsed ? 0 : 12,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  backgroundColor: active ? '#F0FFF0' : 'transparent',
                  color: active ? '#1A1918' : '#9C9B99',
                  fontWeight: active ? 600 : 500,
                  fontSize: 14,
                  fontFamily: 'Outfit, sans-serif',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                <item.icon
                  style={{ width: 16, height: 16, color: active ? '#1A1918' : '#9C9B99', flexShrink: 0 }}
                />
                {!collapsed && item.name}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main content — shifts with sidebar */}
      <main
        style={{
          marginLeft: w,
          padding: 32,
          minHeight: '100vh',
          transition: 'margin-left 180ms ease',
        }}
      >
        {children}
      </main>
    </div>
  )
}
