import { useEffect, useState } from 'react';
import { ordersApi } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import './Orders.css';

interface Order {
  _id: string;
  userId: { usn: string; name: string; college?: string };
  items: { name: string; quantity: number; price?: number; tempPreference?: string; chefNote?: string }[];
  totalAmount: number;
  status: string;
  college?: string;
  createdAt: string;
}

const COLLEGE_OPTIONS = ['DSCE', 'NIE'] as const;

const resolveCollege = (value?: string | null) => (value === 'NIE' ? 'NIE' : 'DSCE');

const formatTemperature = (value?: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : '';

export default function OrdersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState('all');
  const [selectedCollege, setSelectedCollege] = useState(resolveCollege(user?.college));
  const socket = useSocket();

  useEffect(() => {
    setSelectedCollege(resolveCollege(user?.college));
  }, [user?.college]);

  useEffect(() => {
    void fetchOrders();
  }, [selectedCollege, user?.college, user?.role]);

  useEffect(() => {
    if (socket) {
      socket.on('order:update', () => void fetchOrders());
    }
    return () => {
      socket?.off('order:update');
    };
  }, [selectedCollege, socket, user?.college, user?.role]);

  const fetchOrders = async () => {
    try {
      const response = await ordersApi.getOrders(isAdmin ? selectedCollege : user?.college);
      setOrders(response.data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };

  const filteredOrders = filter === 'all'
    ? orders
    : orders.filter(o => o.status === filter);

  return (
    <div className="orders-page">
      <h1>Orders</h1>

      <div className="orders-toolbar">
        <div className="filters">
          {['all', 'pending_payment', 'paid', 'preparing', 'fulfilled'].map((f) => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>

        {isAdmin ? (
          <select
            className="input orders-college-filter"
            value={selectedCollege}
            onChange={(e) => setSelectedCollege(resolveCollege(e.target.value))}
          >
            {COLLEGE_OPTIONS.map((college) => (
              <option key={college} value={college}>
                {college} orders
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Time</th>
            <th>College</th>
            <th>USN</th>
            <th>Student</th>
            <th>Items</th>
            <th>Total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredOrders.map((order) => (
            <tr key={order._id}>
              <td>{new Date(order.createdAt).toLocaleString()}</td>
              <td>{resolveCollege(order.college || order.userId?.college)}</td>
              <td>{order.userId?.usn || 'N/A'}</td>
              <td>{order.userId?.name || 'N/A'}</td>
              <td className="order-items-cell">
                {order.items.map((item, index) => (
                  <div key={`${order._id}-${index}`} className="order-item-line">
                    <div className="order-item-main">
                      {item.name} x{item.quantity}
                    </div>
                    <div className="order-item-meta">
                      {[
                        formatTemperature(item.tempPreference),
                        typeof item.price === 'number' ? `₹${item.price}` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                    {item.chefNote ? (
                      <div className="chef-note">
                        <span className="chef-note-icon">Chef note</span>
                        <span>{item.chefNote}</span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </td>
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
  );
}
