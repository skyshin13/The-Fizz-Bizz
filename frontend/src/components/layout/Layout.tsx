import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { usePendingRequests } from '../../hooks/usePendingRequests'
import {
  LayoutDashboard, FlaskConical, BookOpen, Dna, Calculator, LogOut, Compass, UserCircle
} from 'lucide-react'
import styles from './Layout.module.css'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/projects', icon: FlaskConical, label: 'Projects' },
  { to: '/explore', icon: Compass, label: 'Explore' },
  { to: '/yeasts', icon: Dna, label: 'Yeast Library' },
  { to: '/recipes', icon: BookOpen, label: 'Recipes' },
  { to: '/calculators', icon: Calculator, label: 'Calculators' },
  { to: '/profile', icon: UserCircle, label: 'Profile & Friends' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const pendingCount = usePendingRequests()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className={styles.root}>
      <aside className={styles.sidebar}>
        {/* Logo */}
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🫧</span>
          <div>
            <div className={styles.logoText}>Fizz Bizz</div>
            <div className={styles.logoSub}>Fermentation Studio</div>
          </div>
        </div>

        {/* Decorative bubbles */}
        <div className={styles.bubbles}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className={styles.bubble} style={{
              left: `${10 + i * 14}%`,
              animationDelay: `${i * 0.7}s`,
              animationDuration: `${3 + i * 0.5}s`,
              width: `${8 + i * 3}px`,
              height: `${8 + i * 3}px`,
            }} />
          ))}
        </div>

        {/* Navigation */}
        <nav className={styles.nav}>
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              <span className={styles.iconWrap}>
                <Icon size={18} />
                {to === '/profile' && pendingCount > 0 && (
                  <span className={styles.dot} />
                )}
              </span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className={styles.userSection}>
          <div className={styles.userCard}>
            <div className={styles.avatar}>
              {user?.display_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || '?'}
            </div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{user?.display_name || user?.username}</div>
              <div className={styles.userEmail}>{user?.email}</div>
            </div>
          </div>
          <button onClick={handleLogout} className={styles.logoutBtn} title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <Outlet />
      </main>

      {/* Bottom nav — mobile only, icons only */}
      <nav className={styles.bottomNav}>
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={label}
            className={({ isActive }) =>
              `${styles.bottomNavItem} ${isActive ? styles.bottomNavItemActive : ''}`
            }
          >
            <span className={styles.iconWrap}>
              <Icon size={22} />
              {to === '/profile' && pendingCount > 0 && (
                <span className={styles.countBadge}>{pendingCount > 9 ? '9+' : pendingCount}</span>
              )}
            </span>
          </NavLink>
        ))}
        <button
          onClick={handleLogout}
          title="Sign out"
          className={styles.bottomNavLogout}
        >
          <LogOut size={22} />
        </button>
      </nav>
    </div>
  )
}
