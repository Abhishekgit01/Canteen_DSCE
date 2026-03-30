import { useState } from 'react';
import { ArrowLeft, Minus, Plus, CreditCard, Wallet, ChevronRight, Smartphone, Tag, ShieldCheck } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import { FoodCard } from '../components/FoodCard';
import { extraItems, MenuItem } from '../data/menuItems';
import { BottomNav } from '../components/BottomNav';
import { motion } from 'motion/react';

export function Cart() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialCart = location.state?.cart || [];

  const [cart, setCart] = useState<{ item: MenuItem; quantity: number }[]>(initialCart);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'upi' | 'card'>('wallet');
  const walletBalance = 450;

  const handleQuantityChange = (itemId: string, delta: number) => {
    setCart(cart.map(c => {
      if (c.item.id === itemId) {
        const newQuantity = Math.max(0, c.quantity + delta);
        return newQuantity === 0 ? null : { ...c, quantity: newQuantity };
      }
      return c;
    }).filter(Boolean) as { item: MenuItem; quantity: number }[]);
  };

  const handleAddExtra = (item: MenuItem) => {
    const existingItem = cart.find(c => c.item.id === item.id);
    if (existingItem) {
      setCart(cart.map(c =>
        c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
      ));
    } else {
      setCart([...cart, { item, quantity: 1 }]);
    }
  };

  const subtotal = cart.reduce((sum, c) => sum + (c.item.price * c.quantity), 0);
  const serviceFee = 2;
  const total = subtotal + serviceFee;
  const savings = paymentMethod === 'wallet' ? 15 : 0;
  const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);

  const handlePlaceOrder = () => {
    navigate('/order-tracking', { state: { cart, total: total - savings, orderId: 'DSU' + Math.floor(1000 + Math.random() * 9000) } });
  };

  return (
    <div className="min-h-screen bg-[#F2F0ED] pb-28">
      {/* Header */}
      <header className="bg-white px-4 py-3 sticky top-0 z-40" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/')} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-gray-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '17px' }}>Checkout</h1>
            <p className="text-xs text-gray-500">NRI Canteen · {totalItems} items</p>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-4">
        {/* Your Order */}
        <div className="bg-white rounded-2xl p-4 mb-3" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          <h2 className="text-gray-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '16px' }}>Your Order</h2>
          {cart.map((cartItem, idx) => (
            <motion.div
              key={cartItem.item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center gap-3 mb-4 last:mb-0"
            >
              <img
                src={cartItem.item.image}
                alt={cartItem.item.name}
                className="w-16 h-16 rounded-xl object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className={`w-3.5 h-3.5 border-2 ${cartItem.item.isVeg ? 'border-green-600' : 'border-red-500'} rounded-sm flex items-center justify-center`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${cartItem.item.isVeg ? 'bg-green-600' : 'bg-red-500'}`} />
                  </div>
                  <h3 className="text-sm text-gray-900 truncate" style={{ fontWeight: 600 }}>{cartItem.item.name}</h3>
                </div>
                <p className="text-xs text-gray-500 line-clamp-1">{cartItem.item.description}</p>
                <p className="text-sm text-gray-900 mt-1" style={{ fontWeight: 700 }}>₹{cartItem.item.price}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center bg-[#F5821F] rounded-lg overflow-hidden">
                  <button
                    onClick={() => handleQuantityChange(cartItem.item.id, -1)}
                    className="w-7 h-7 flex items-center justify-center text-white"
                  >
                    <Minus size={13} />
                  </button>
                  <span className="w-5 text-center text-white text-xs" style={{ fontWeight: 700 }}>{cartItem.quantity}</span>
                  <button
                    onClick={() => handleQuantityChange(cartItem.item.id, 1)}
                    className="w-7 h-7 flex items-center justify-center text-white"
                  >
                    <Plus size={13} />
                  </button>
                </div>
                <span className="text-xs text-gray-500">₹{cartItem.item.price * cartItem.quantity}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Add more items */}
        <div className="mb-3">
          <div className="flex items-center justify-between px-1 mb-3">
            <h2 className="text-gray-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '15px' }}>Add more items</h2>
            <button className="text-[#F5821F] text-xs" style={{ fontWeight: 600 }}>SEE ALL</button>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {extraItems.map((item) => (
              <FoodCard key={item.id} item={item} onAdd={handleAddExtra} size="small" />
            ))}
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-2xl p-4 mb-3" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          <h2 className="text-gray-900 mb-3" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '15px' }}>Payment Method</h2>

          <PaymentOption
            selected={paymentMethod === 'wallet'}
            onClick={() => setPaymentMethod('wallet')}
            icon={<Wallet size={18} />}
            label="Campus Credit"
            sublabel={`Balance: ₹${walletBalance}`}
            iconBg="bg-[#8B1A1A]"
          />
          <PaymentOption
            selected={paymentMethod === 'upi'}
            onClick={() => setPaymentMethod('upi')}
            icon={<Smartphone size={18} />}
            label="UPI (GPay / PhonePe)"
            iconBg="bg-purple-600"
          />
          <PaymentOption
            selected={paymentMethod === 'card'}
            onClick={() => setPaymentMethod('card')}
            icon={<CreditCard size={18} />}
            label="Debit / Credit Card"
            iconBg="bg-gray-700"
          />
        </div>

        {/* Bill Summary */}
        <div className="bg-white rounded-2xl p-4 mb-3" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          <h2 className="text-gray-900 mb-3" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '15px' }}>Bill Summary</h2>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span style={{ fontWeight: 500 }}>₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Service Fee</span>
              <span style={{ fontWeight: 500 }}>₹{serviceFee.toFixed(2)}</span>
            </div>
            {savings > 0 && (
              <div className="flex justify-between text-green-600">
                <span className="flex items-center gap-1"><Tag size={13} /> Wallet Discount</span>
                <span style={{ fontWeight: 500 }}>-₹{savings.toFixed(2)}</span>
              </div>
            )}
            <div className="pt-2.5 mt-1" style={{ borderTop: '1.5px dashed #E5E5E5' }}>
              <div className="flex justify-between text-gray-900">
                <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '17px' }}>Total</span>
                <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '17px' }}>₹{(total - savings).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {savings > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 bg-green-50 rounded-xl p-3 flex items-center gap-2"
            >
              <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Tag size={14} className="text-green-600" />
              </div>
              <span className="text-xs text-green-700" style={{ fontWeight: 500 }}>
                You're saving ₹{savings} on this order with Campus Rewards!
              </span>
            </motion.div>
          )}
        </div>

        {/* Complete Purchase */}
        <button
          onClick={handlePlaceOrder}
          disabled={cart.length === 0}
          className="w-full bg-gradient-to-r from-[#F5821F] to-[#FF9F43] text-white py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.98]"
          style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '15px', boxShadow: '0 8px 24px rgba(245,130,31,0.3)' }}
        >
          <ShieldCheck size={18} />
          Complete Purchase
          <ChevronRight size={18} />
        </button>
      </div>

      <BottomNav />
    </div>
  );
}

function PaymentOption({ selected, onClick, icon, label, sublabel, iconBg }: {
  selected: boolean; onClick: () => void; icon: React.ReactNode; label: string; sublabel?: string; iconBg: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-3 rounded-xl mb-2 transition-all ${
        selected ? 'bg-[#FAF8F5] ring-2 ring-[#F5821F]' : 'bg-[#FAFAFA]'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 ${iconBg} rounded-lg flex items-center justify-center text-white`}>
          {icon}
        </div>
        <div className="text-left">
          <div className="text-sm text-gray-900" style={{ fontWeight: 600 }}>{label}</div>
          {sublabel && <div className="text-xs text-gray-500">{sublabel}</div>}
        </div>
      </div>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
        selected ? 'border-[#F5821F]' : 'border-gray-300'
      }`}>
        {selected && <div className="w-2.5 h-2.5 rounded-full bg-[#F5821F]" />}
      </div>
    </button>
  );
}
