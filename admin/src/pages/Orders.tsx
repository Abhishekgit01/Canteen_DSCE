import { useEffect, useMemo, useState } from 'react';
import { ordersApi } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import './Orders.css';

interface Order {
  _id: string;
  userId: { usn: string; name: string; college?: string };
  items: {
    name: string;
    quantity: number;
    price?: number;
    tempPreference?: string;
    chefNote?: string;
  }[];
  totalAmount: number;
  status: string;
  college?: string;
  scheduledTime?: string;
  isPreOrder?: boolean;
  scheduledFor?: string;
  preOrderNote?: string;
  estimatedPickupMinutes?: number;
  estimatedPickupAt?: string;
  createdAt: string;
}

const COLLEGE_OPTIONS = ['DSCE', 'NIE'] as const;
const FILTER_OPTIONS = [
  'all',
  'preorder',
  'paid',
  'preparing',
  'ready',
  'fulfilled',
  'pending_payment',
] as const;

const ACTIVE_STATUSES = new Set(['paid', 'preparing', 'ready']);

const STATUS_PRIORITY: Record<string, number> = {
  ready: 0,
  preparing: 1,
  paid: 2,
  pending_payment: 3,
  fulfilled: 4,
  failed: 5,
};

const resolveCollege = (value?: string | null) => (value === 'NIE' ? 'NIE' : 'DSCE');

const formatTemperature = (value?: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : '';

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Not scheduled yet';
  }

  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTimeOnly(value?: string | null) {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getCountdown(scheduledFor?: string) {
  if (!scheduledFor) {
    return '';
  }

  const diff = new Date(scheduledFor).getTime() - Date.now();
  if (diff <= 0) {
    return 'Due now';
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `Due in ${hours}h ${minutes}m`;
  }

  return `Due in ${minutes}m`;
}

function getStatusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

function getStatusClassName(status: string) {
  return `status-${status.replace(/_/g, '-')}`;
}

function getNextAction(order: Order) {
  if (order.status === 'paid') {
    return {
      nextStatus: 'preparing',
      label: order.isPreOrder ? 'Start prep' : 'Start preparing',
      description: order.isPreOrder
        ? 'Move this scheduled order into the kitchen workflow.'
        : 'Let the student know the kitchen has started.',
    };
  }

  if (order.status === 'preparing') {
    return {
      nextStatus: 'ready',
      label: 'Mark ready',
      description: 'Tell the student the QR pickup can happen now.',
    };
  }

  return null;
}

export default function OrdersPage() {
  const { user } = useAuth();
  const socket = useSocket();
  const isAdmin = user?.role === 'admin';
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<(typeof FILTER_OPTIONS)[number]>('all');
  const [selectedCollege, setSelectedCollege] = useState(resolveCollege(user?.college));
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedCollege(resolveCollege(user?.college));
  }, [user?.college]);

  useEffect(() => {
    void fetchOrders();
  }, [selectedCollege, user?.college, user?.role]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const refresh = () => void fetchOrders();
    socket.on('order:update', refresh);

    return () => {
      socket.off('order:update', refresh);
    };
  }, [selectedCollege, socket, user?.college, user?.role]);

  async function fetchOrders() {
    try {
      setLoading(true);
      const response = await ordersApi.getOrders(isAdmin ? selectedCollege : user?.college);
      setOrders(response.data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setStatusMessage('Could not load the live order queue right now.');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusUpdate(order: Order, nextStatus: string) {
    try {
      setUpdatingOrderId(order._id);
      setStatusMessage('');
      await ordersApi.updateOrderStatus(order._id, nextStatus);
      setStatusMessage(
        `${order.userId?.name || 'Student'} moved to ${getStatusLabel(nextStatus)}.`,
      );
      await fetchOrders();
    } catch (error) {
      console.error('Failed to update order status:', error);
      setStatusMessage('Could not update the order status. Please retry.');
    } finally {
      setUpdatingOrderId(null);
    }
  }

  const filteredOrders = useMemo(() => {
    const nextOrders =
      filter === 'all'
        ? [...orders]
        : filter === 'preorder'
          ? orders.filter((order) => order.isPreOrder)
          : orders.filter((order) => order.status === filter);

    nextOrders.sort((left, right) => {
      const leftPriority = STATUS_PRIORITY[left.status] ?? 99;
      const rightPriority = STATUS_PRIORITY[right.status] ?? 99;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      if (left.isPreOrder && right.isPreOrder && left.scheduledFor && right.scheduledFor) {
        return new Date(left.scheduledFor).getTime() - new Date(right.scheduledFor).getTime();
      }

      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();

      return rightTime - leftTime;
    });

    return nextOrders;
  }, [filter, orders]);

  const summary = useMemo(() => {
    const now = Date.now();
    const upcomingPreOrders = orders.filter(
      (order) =>
        order.isPreOrder &&
        order.scheduledFor &&
        new Date(order.scheduledFor).getTime() >= now &&
        order.status !== 'fulfilled' &&
        order.status !== 'failed',
    ).length;
    const activeLine = orders.filter((order) => ACTIVE_STATUSES.has(order.status)).length;
    const readyNow = orders.filter((order) => order.status === 'ready').length;
    const dueSoon = orders.filter((order) => {
      if (!order.isPreOrder || !order.scheduledFor) {
        return false;
      }

      const diff = new Date(order.scheduledFor).getTime() - now;
      return diff >= 0 && diff <= 90 * 60 * 1000;
    }).length;

    return {
      activeLine,
      upcomingPreOrders,
      readyNow,
      dueSoon,
    };
  }, [orders]);

  return (
    <div className="orders-page">
      <section className="orders-hero">
        <div className="orders-hero-copy">
          <span className="orders-eyebrow">Staff Operations</span>
          <h1>Order Control</h1>
          <p>
            Keep the live line moving, spot scheduled pickups early, and move each order through
            the kitchen with fewer tab changes.
          </p>
        </div>

        <div className="orders-hero-meta">
          <div className="orders-hero-panel">
            <span className="orders-hero-label">Viewing</span>
            <strong>{isAdmin ? `${selectedCollege} kitchen` : `${resolveCollege(user?.college)} kitchen`}</strong>
          </div>
          <div className="orders-hero-panel">
            <span className="orders-hero-label">Live sync</span>
            <strong>{socket ? 'Socket connected' : 'Refreshing manually'}</strong>
          </div>
        </div>
      </section>

      <section className="orders-summary-grid">
        <article className="orders-summary-card">
          <span className="orders-summary-label">Active line</span>
          <strong className="orders-summary-value">{summary.activeLine}</strong>
          <span className="orders-summary-hint">Paid, preparing, and ready orders</span>
        </article>

        <article className="orders-summary-card">
          <span className="orders-summary-label">Upcoming pre-orders</span>
          <strong className="orders-summary-value">{summary.upcomingPreOrders}</strong>
          <span className="orders-summary-hint">Scheduled pickups still ahead</span>
        </article>

        <article className="orders-summary-card">
          <span className="orders-summary-label">Ready now</span>
          <strong className="orders-summary-value">{summary.readyNow}</strong>
          <span className="orders-summary-hint">Waiting for student QR pickup</span>
        </article>

        <article className="orders-summary-card">
          <span className="orders-summary-label">Due in 90 min</span>
          <strong className="orders-summary-value">{summary.dueSoon}</strong>
          <span className="orders-summary-hint">Scheduled orders that need attention soon</span>
        </article>
      </section>

      <section className="orders-toolbar">
        <div className="orders-filters">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option}
              className={`filter-btn ${filter === option ? 'active' : ''}`}
              onClick={() => setFilter(option)}
            >
              {option === 'preorder' ? 'pre-orders' : getStatusLabel(option)}
            </button>
          ))}
        </div>

        <div className="orders-toolbar-side">
          {statusMessage ? <span className="orders-status-message">{statusMessage}</span> : null}

          {isAdmin ? (
            <select
              className="input orders-college-filter"
              value={selectedCollege}
              onChange={(event) => setSelectedCollege(resolveCollege(event.target.value))}
            >
              {COLLEGE_OPTIONS.map((college) => (
                <option key={college} value={college}>
                  {college} orders
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </section>

      {loading ? (
        <div className="orders-empty-state">Loading the live queue...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="orders-empty-state">
          No orders match this view right now. The next paid or scheduled order will show up here.
        </div>
      ) : (
        <section className="orders-grid">
          {filteredOrders.map((order) => {
            const action = getNextAction(order);
            const college = resolveCollege(order.college || order.userId?.college);
            const pickupTime = order.scheduledFor
              ? formatDateTime(order.scheduledFor)
              : order.estimatedPickupAt
                ? formatDateTime(order.estimatedPickupAt)
                : null;

            return (
              <article
                key={order._id}
                className={`order-card ${order.isPreOrder ? 'preorder-card' : ''}`}
              >
                <div className="order-card-top">
                  <div className="order-meta-row">
                    <span className={`order-status-pill ${getStatusClassName(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                    {order.isPreOrder ? <span className="order-preorder-pill">Scheduled</span> : null}
                    <span className="order-college-pill">{college}</span>
                  </div>
                  <strong className="order-total">₹{order.totalAmount}</strong>
                </div>

                <div className="order-heading">
                  <div>
                    <h2>{order.userId?.name || 'Unknown student'}</h2>
                    <p>
                      {order.userId?.usn || 'No USN'} · Placed {formatDateTime(order.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="order-highlight-card">
                  <span className="order-highlight-label">
                    {order.isPreOrder ? 'Scheduled pickup' : 'Pickup target'}
                  </span>
                  <strong className="order-highlight-value">
                    {pickupTime || 'Awaiting pickup estimate'}
                  </strong>
                  <span className="order-highlight-caption">
                    {order.isPreOrder
                      ? getCountdown(order.scheduledFor)
                      : order.estimatedPickupMinutes
                        ? `About ${order.estimatedPickupMinutes} minutes from payment`
                        : order.scheduledTime
                          ? `Selected pickup slot ${order.scheduledTime}`
                          : 'Live order, ready when kitchen confirms'}
                  </span>
                </div>

                <div className="order-items-list">
                  {order.items.map((item, index) => (
                    <div key={`${order._id}-${index}`} className="order-item-row">
                      <div>
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
                      </div>

                      {item.chefNote ? (
                        <div className="order-note-card">
                          <span className="order-note-label">Chef note</span>
                          <span>{item.chefNote}</span>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                {order.preOrderNote ? (
                  <div className="order-note-card preorder-note">
                    <span className="order-note-label">Pre-order note</span>
                    <span>{order.preOrderNote}</span>
                  </div>
                ) : null}

                <div className="order-footer">
                  <div className="order-footer-copy">
                    <strong>{order.isPreOrder ? 'Scheduled service' : 'Live kitchen flow'}</strong>
                    <span>
                      {action
                        ? action.description
                        : order.status === 'ready'
                          ? 'Waiting for the student to scan their QR at pickup.'
                          : order.status === 'fulfilled'
                            ? 'This order is already completed.'
                            : order.status === 'pending_payment'
                              ? 'Payment has not been confirmed yet.'
                              : 'No staff action is needed on this order right now.'}
                    </span>
                  </div>

                  {action ? (
                    <button
                      className="order-action-btn"
                      disabled={updatingOrderId === order._id}
                      onClick={() => void handleStatusUpdate(order, action.nextStatus)}
                    >
                      {updatingOrderId === order._id ? 'Saving...' : action.label}
                    </button>
                  ) : (
                    <span className="order-time-meta">
                      {formatTimeOnly(order.scheduledFor || order.estimatedPickupAt) || 'No action'}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
