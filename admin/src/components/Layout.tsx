import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './Layout.css';

export default function Layout({ children }: { children?: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', roles: ['manager', 'admin'] },
    { path: '/menu', label: 'Menu', roles: ['manager', 'admin'] },
    { path: '/notifications', label: 'Notifications', roles: ['manager', 'admin'] },
    { path: '/reviews', label: 'Reviews', roles: ['manager', 'admin'] },
    { path: '/rush-hours', label: 'Rush Hours', roles: ['manager', 'admin'] },
    { path: '/orders', label: 'Orders', roles: ['staff', 'manager', 'admin'] },
    { path: '/users', label: 'Users', roles: ['admin'] },
  ];

  const visibleNav = navItems.filter(item => item.roles.includes(user?.role || ''));

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">
          <span>{user?.college ? `${user.college} Canteen` : 'Canteen Control'}</span>
          <small className="logo-subtitle">Manager dashboard</small>
        </div>
        <nav>
          {visibleNav.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={location.pathname === item.path ? 'active' : ''}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="user-info">
          <span>{user?.name}</span>
          <span className="role">{user?.role}</span>
          <button onClick={handleLogout} className="btn btn-secondary">
            Logout
          </button>
        </div>
      </aside>
      <main className="main-content">
        {children || <Outlet />}
      </main>
    </div>
  );
}
