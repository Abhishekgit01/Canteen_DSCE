import { useEffect, useState } from 'react';
import { statsApi, ordersApi } from '../api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useSocket } from '../hooks/useSocket';
import './Dashboard.css';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    ordersToday: 0,
    revenueToday: 0,
    pendingOrders: 0,
    popularItem: 'None',
    revenueHistory: [],
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const socket = useSocket();

  useEffect(() => {
    fetchStats();
    fetchOrders();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('order:update', () => {
        fetchStats();
        fetchOrders();
      });
    }
    return () => {
      socket?.off('order:update');
    };
  }, [socket]);

  const fetchStats = async () => {
    try {
      const response = await statsApi.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await ordersApi.getOrders();
      setRecentOrders(response.data.slice(0, 10));
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Orders Today</span>
          <span className="stat-value">{stats.ordersToday}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Revenue Today</span>
          <span className="stat-value">₹{stats.revenueToday}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Pending Orders</span>
          <span className="stat-value">{stats.pendingOrders}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Popular Item</span>
          <span className="stat-value popular">{stats.popularItem}</span>
        </div>
      </div>

      <div className="chart-container" style={{ marginTop: '20px', backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h2 style={{ marginBottom: '20px', fontSize: '1.2rem', color: '#1a1d20' }}>7-Day Revenue History</h2>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart
              data={stats.revenueHistory}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748B' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B' }} tickFormatter={(value) => `₹${value}`} />
              <Tooltip 
                cursor={{ fill: '#F1F5F9' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                formatter={(value: number) => [`₹${value}`, 'Revenue']}
              />
              <Bar dataKey="revenue" fill="#f5821f" radius={[4, 4, 0, 0]} maxBarSize={50} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="recent-orders" style={{ marginTop: '20px' }}>
        <h2>Recent Orders</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>USN</th>
              <th>Student</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.map((order: any) => (
              <tr key={order._id}>
                <td>{new Date(order.createdAt).toLocaleTimeString()}</td>
                <td>{order.userId?.usn || 'N/A'}</td>
                <td>{order.userId?.name || 'N/A'}</td>
                <td>{order.items.map((i: any) => i.name).join(', ')}</td>
                <td>₹{order.totalAmount}</td>
                <td>
                  <span className={`badge badge-${order.status}`}>
                    {order.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
