'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navItems } from './nav';
import { Icons } from './icons';
import ThemeToggle from './ThemeToggle';
import styles from './Sidebar.module.css';

export default function Sidebar({
  collapsed,
  onToggleCollapse,
  className,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={className ? `${styles.sidebar} ${className}` : styles.sidebar}
      data-collapsed={collapsed}
    >
      <Link href="/conexao" className={styles.brand} title="Torre">
        <span className={styles.brandMark} aria-hidden="true" />
        {!collapsed && <span className={styles.brandText}>Torre</span>}
      </Link>

      <nav className={styles.nav} aria-label="Navegação principal">
        {navItems.map((item) => {
          const Icon = Icons[item.icon];
          const active =
            pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={styles.navItem}
              data-active={active}
              title={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <span className={styles.navIcon}>
                <Icon />
              </span>
              {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <ThemeToggle collapsed={collapsed} />
        <button
          type="button"
          className={styles.footerBtn}
          onClick={onToggleCollapse}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <span className={styles.footerIcon} data-collapsed={collapsed}>
            <Icons.chevron />
          </span>
          {!collapsed && <span className={styles.footerLabel}>Recolher</span>}
        </button>
      </div>
    </aside>
  );
}
