import { ShoppingBag, ChevronRight, RotateCcw } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { useNavigate } from 'react-router-dom';

const pastOrders = [
  { id: 'DSU2847', date: 'Today, 12:30 PM', items: ['Masala Dosa', 'Cutting Chai'], total: 60, status: 'Delivered' },
  { id: 'DSU2791', date: 'Yesterday, 1:15 PM', items: ['Chicken Biryani', 'Cold Coffee'], total: 165, status: 'Delivered' },
  { id: 'DSU2688', date: 'Mar 27, 11:45 AM', items: ['Cheese Maggi'], total: 60, status: 'Delivered' },
];

export function Orders() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-24">
      <div className="max-w-md mx-auto px-4 pt-4">
        <h1 className="text-gray-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '20px' }}>Your Orders</h1>

        <div className="space-y-3">
          {pastOrders.map(order => (
            <div key={order.id} className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-gray-900" style={{ fontWeight: 600 }}>Order #{order.id}</p>
                  <p className="text-xs text-gray-500">{order.date}</p>
                </div>
                <span className="text-xs bg-green-50 text-green-600 px-2.5 py-1 rounded-full" style={{ fontWeight: 600 }}>{order.status}</span>
              </div>
              <p className="text-xs text-gray-600 mb-3">{order.items.join(' · ')}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-900" style={{ fontWeight: 700 }}>₹{order.total}</span>
                <button className="flex items-center gap-1 text-[#F5821F] text-xs" style={{ fontWeight: 600 }}>
                  <RotateCcw size={13} /> Reorder
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
