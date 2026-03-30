import { useState, useEffect } from 'react';
import { ArrowLeft, Phone, MessageCircle, HelpCircle, MapPin, ChevronRight, CheckCircle2, Clock, ChefHat, Package } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BottomNav } from '../components/BottomNav';
import { Order, OrderStatus } from '../../lib/api';
import { socketClient } from '../../lib/socket';

const steps = [
  { key: 'confirmed' as const, label: 'Order Confirmed', desc: 'Your order has been received', icon: CheckCircle2 },
  { key: 'preparing' as const, label: 'Preparing Your Meal', desc: 'The chef is assembling your items now', icon: ChefHat },
  { key: 'ready' as const, label: 'Ready for Pickup', desc: 'Head to Counter 3 for collection', icon: Package },
];

export function OrderTracking() {
  const navigate = useNavigate();
  const location = useLocation();
  const order = location.state?.order as Order | undefined;

  const [status, setStatus] = useState<OrderStatus>(order?.status || 'confirmed');
  const [eta, setEta] = useState(order?.eta || 12);

  useEffect(() => {
    // Listen for real-time order updates
    const handleOrderUpdate = (data: { orderId: string; status: OrderStatus; eta: number; message: string }) => {
      if (order && data.orderId === order.orderId) {
        setStatus(data.status);
        setEta(data.eta);
      }
    };

    socketClient.on('order:update', handleOrderUpdate);

    return () => {
      socketClient.off('order:update', handleOrderUpdate);
    };
  }, [order]);

  useEffect(() => {
    const timer = setInterval(() => {
      setEta((prev: number) => Math.max(1, prev - 1));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const getStepStatus = (stepKey: OrderStatus) => {
    const order = ['confirmed', 'preparing', 'ready'];
    const current = order.indexOf(status);
    const step = order.indexOf(stepKey);
    if (step < current) return 'done';
    if (step === current) return 'active';
    return 'pending';
  };

  const now = new Date();
  const pickupTime = new Date(now.getTime() + eta * 60000);
  const pickupTimeStr = pickupTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-28">
      {/* Header */}
      <header className="bg-[#8B1A1A] px-4 pt-3 pb-4 sticky top-0 z-40">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="w-9 h-9 bg-white/15 rounded-full flex items-center justify-center">
              <ArrowLeft size={20} className="text-white" />
            </button>
            <div>
              <h1 className="text-white" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '17px' }}>NRI Canteen</h1>
              <p className="text-white/60 text-xs">ORDER ID: #{order?.orderId || 'DSU2847'}</p>
            </div>
          </div>
          <button className="w-9 h-9 bg-white/15 rounded-full flex items-center justify-center">
            <HelpCircle size={18} className="text-white" />
          </button>
        </div>
      </header>

      <div className="max-w-md mx-auto">
        {/* Hero Status */}
        <div className="px-4 pt-5 pb-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <motion.div
              key={status}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="w-16 h-16 bg-[#F5821F]/10 rounded-full flex items-center justify-center mx-auto mb-3"
            >
              {status === 'confirmed' && <CheckCircle2 size={32} className="text-[#F5821F]" />}
              {status === 'preparing' && <ChefHat size={32} className="text-[#F5821F]" />}
              {status === 'ready' && <Package size={32} className="text-green-500" />}
            </motion.div>
            <h2 className="text-gray-900 mb-1" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '20px' }}>
              {status === 'confirmed' && "Order Confirmed!"}
              {status === 'preparing' && "Chef is preparing your meal"}
              {status === 'ready' && "Your order is ready!"}
            </h2>
            <p className="text-sm text-gray-500">
              {status === 'confirmed' && "Deliciousness is in the works!"}
              {status === 'preparing' && "Almost there, hang tight!"}
              {status === 'ready' && "Head to the counter for pickup"}
            </p>
          </motion.div>
        </div>

        {/* ETA Cards */}
        <div className="px-4 mb-4">
          <div className="flex gap-3">
            <div className="flex-1 bg-white rounded-xl p-3 text-center" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
              <p className="text-[10px] text-gray-500 tracking-wider mb-1">ARRIVING IN</p>
              <p className="text-[#F5821F]" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '24px' }}>{eta} mins</p>
            </div>
            <div className="flex-1 bg-white rounded-xl p-3 text-center" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
              <p className="text-[10px] text-gray-500 tracking-wider mb-1">PICK UP BY</p>
              <p className="text-gray-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '24px' }}>{pickupTimeStr}</p>
            </div>
          </div>
        </div>

        {/* Map-like section */}
        <div className="px-4 mb-4">
          <div className="relative rounded-2xl overflow-hidden h-[140px]" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <img
              src="https://images.unsplash.com/photo-1546833998-07256bcc76ad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmRpYW4lMjBjYW50ZWVuJTIwbWFwJTIwYWVyaWFsJTIwZ3JlZW58ZW58MXx8fHwxNzc0Nzk5MjM5fDA&ixlib=rb-4.1.0&q=80&w=1080"
              alt="Campus map"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute top-3 right-3">
              <div className="bg-green-500 text-white px-3 py-1.5 rounded-full text-xs flex items-center gap-1" style={{ fontWeight: 600 }}>
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                Live Tracking
              </div>
            </div>
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <div className="w-8 h-8 bg-[#F5821F] rounded-full flex items-center justify-center">
                <MapPin size={16} className="text-white" />
              </div>
              <div>
                <p className="text-white text-xs" style={{ fontWeight: 600 }}>YOUR LOCATION</p>
                <p className="text-white/80 text-xs">Main Library, Floor 2</p>
              </div>
            </div>
          </div>
        </div>

        {/* Order Progress Timeline */}
        <div className="px-4 mb-4">
          <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <h3 className="text-gray-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '15px' }}>Order Progress</h3>
            <div className="space-y-0">
              {steps.map((step, idx) => {
                const stepStatus = getStepStatus(step.key);
                const Icon = step.icon;
                return (
                  <div key={step.key} className="flex gap-3">
                    {/* Timeline */}
                    <div className="flex flex-col items-center">
                      <motion.div
                        initial={false}
                        animate={{
                          backgroundColor: stepStatus === 'pending' ? '#E5E7EB' : stepStatus === 'active' ? '#F5821F' : '#22C55E',
                          scale: stepStatus === 'active' ? 1.1 : 1,
                        }}
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      >
                        <Icon size={16} className="text-white" />
                      </motion.div>
                      {idx < steps.length - 1 && (
                        <div className="w-0.5 h-10 bg-gray-200 relative">
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: stepStatus !== 'pending' ? '100%' : '0%' }}
                            className="absolute top-0 left-0 w-full bg-green-500"
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                      )}
                    </div>
                    {/* Content */}
                    <div className="pb-5">
                      <p className={`text-sm ${stepStatus === 'active' ? 'text-[#F5821F]' : stepStatus === 'done' ? 'text-gray-900' : 'text-gray-400'}`}
                        style={{ fontWeight: stepStatus === 'active' ? 700 : 500 }}>
                        {step.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
                      {stepStatus === 'done' && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {idx === 0 ? `Received at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="px-4 mb-4">
          <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-gray-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '15px' }}>ORDER SUMMARY</h3>
              <button className="text-[#F5821F] text-xs" style={{ fontWeight: 600 }}>View Details</button>
            </div>
            {order?.items.map((item) => (
              <div key={item.itemId} className="flex items-center gap-3 mb-3 last:mb-0">
                <div className="w-11 h-11 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Package size={20} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm text-gray-900 truncate" style={{ fontWeight: 600 }}>{item.name}</h4>
                  <p className="text-xs text-gray-500">{item.isVeg ? 'Regular' : 'Extra Spice'} · {item.quantity} unit</p>
                </div>
                <span className="text-sm text-gray-900" style={{ fontWeight: 700 }}>₹{item.price * item.quantity}</span>
              </div>
            ))}
            <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1.5px dashed #E5E5E5' }}>
              <div>
                <span className="text-xs text-gray-500">Total Amount</span>
                <br />
                <span className="text-xs text-gray-400">Paid via Campus Wallet</span>
              </div>
              <span className="text-gray-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '18px' }}>₹{order?.total || 0}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-4 grid grid-cols-2 gap-3">
          <button className="flex items-center justify-center gap-2 bg-white text-[#8B1A1A] py-3.5 rounded-xl transition-colors"
            style={{ fontWeight: 600, fontSize: '13px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <Phone size={16} />
            Call Canteen
          </button>
          <button className="flex items-center justify-center gap-2 bg-[#F5821F] text-white py-3.5 rounded-xl transition-colors"
            style={{ fontWeight: 600, fontSize: '13px', boxShadow: '0 8px 24px rgba(245,130,31,0.3)' }}>
            <MessageCircle size={16} />
            Live Support
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
