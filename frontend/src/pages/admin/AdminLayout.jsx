import { NavLink, Outlet, useLocation } from 'react-router-dom'
import Brand from '../../components/Brand.jsx'

const NAV = [['/admin', '대시보드', '01'], ['/admin/reports', '점검 대상 목록', '02'], ['/admin/integrated', '통합 점검 후보', '03'], ['/admin/report', '점검 확인서', '04']]
export default function AdminLayout() {
  const { pathname } = useLocation()
  const title = NAV.find(([path]) => path === pathname)?.[1] ?? '제보 상세'
  return <div className="admin-shell">
    <aside className="admin-sidebar print:hidden">
      <div className="admin-brand"><Brand inverse home="/admin" /><span>성북구 안전 담당</span></div>
      <nav aria-label="관리자 메뉴">{NAV.map(([path, label, number]) => <NavLink key={path} to={path} end={path === '/admin'} className={({ isActive }) => `admin-nav-link ${isActive ? 'is-active' : ''}`}><span className="nav-number">{number}</span>{label}</NavLink>)}</nav>
      <p className="admin-sidebar-note">주민의 발견에서<br />담당자의 조치까지</p>
    </aside>
    <div className="admin-workspace">
      <header className="admin-header print:hidden"><div className="mobile-brand"><Brand home="/admin" /></div><span>{title}</span><span className="admin-header-caption">성북 안전공백지도 · 관리자</span></header>
      <main className="admin-content"><Outlet /></main>
    </div>
  </div>
}
