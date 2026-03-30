import { useEffect, useState } from 'react';
import { ordersApi } from '../api';
import { useSocket } from '../hooks/useSocket';
import './Orders.css';

interface Order {
  _id: string;
  userId: { usn: string; name: string };
  items: { name: string; quantity: number }[];
  totalAmount: number;
  status: string;
  createdAt: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState('all');
  const socket = useSocket();

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('order:update', () => fetchOrders());
    }
    return () => {
      socket?.off('order:update');
    };
  }, [socket]);

  const fetchOrders = async () => {
    try {
      const response = await ordersApi.getOrders();
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
          {filteredOrders.map((order) => (
            <tr key={order._id}>
              <td>{new Date(order.createdAt).toLocaleString()}</td>
              <td>{order.userId?.usn || 'N/A'}</td>
              <td>{order.userId?.name || 'N/A'}</td>
              <td>
                {order.items.map(i => `${i.name} x${i.quantity}`).join(', ')}
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
