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
  isPreOrder?: boolean;
  scheduledFor?: string;
  preOrderNote?: string;
  createdAt: string;
}

const COLLEGE_OPTIONS = ['DSCE', 'NIE'] as const;

const resolveCollege = (value?: string | null) => (value === 'NIE' ? 'NIE' : 'DSCE');

const formatTemperature = (value?: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : '';

function getCountdown(scheduledFor: string) {
  const diff = new Date(scheduledFor).getTime() - Date.now();
  if (diff <= 0) return 'Due now';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) return `Due in ${hours}h ${minutes}m`;
  return `Due in ${minutes}m`;
}

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
    : filter === 'preorder'
      ? orders.filter(o => o.isPreOrder)
      : orders.filter(o => o.status === filter);

  return (
    <div className="orders-page">
      <h1>Orders</h1>

      <div className="orders-toolbar">
        <div className="filters">
          {['all', 'preorder', 'pending_payment', 'paid', 'preparing', 'fulfilled'].map((f) => (
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
              <td>
                <div>{new Date(order.createdAt).toLocaleString()}</div>
                {order.isPreOrder && (
                  <div style={{ marginTop: 4 }}>
                    <span className="badge badge-preorder" style={{ fontSize: '0.7em', padding: '2px 6px' }}>PRE-ORDER</span>
                    {order.scheduledFor && (
                      <>
                        <div style={{ fontSize: '0.8em', color: '#666', marginTop: 2 }}>
                          {new Date(order.scheduledFor).toLocaleString()}
                        </div>
                        <div className="countdown-text">
                          {getCountdown(order.scheduledFor)}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </td>
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
                {order.preOrderNote && (
                  <div className="chef-note" style={{ marginTop: 8 }}>
                    <span className="chef-note-icon" style={{ backgroundColor: '#fff3cd', color: '#856404' }}>Pre-order note</span>
                    <span>{order.preOrderNote}</span>
                  </div>
                )}
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
