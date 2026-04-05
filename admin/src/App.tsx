import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import MenuPage from './pages/Menu';
import NotificationsPage from './pages/NotificationsPage';
import OrdersPage from './pages/Orders';
import ReviewsPage from './pages/ReviewsPage';
import RushHoursPage from './pages/RushHours';
import UsersPage from './pages/Users';
import Layout from './components/Layout';

function ProtectedRoute({ allowedRoles }: { allowedRoles?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute allowedRoles={['manager', 'admin']} />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/rush-hours" element={<RushHoursPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['staff', 'manager', 'admin']} />}>
        <Route element={<Layout />}>
          <Route path="/orders" element={<OrdersPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route element={<Layout />}>
          <Route path="/users" element={<UsersPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
