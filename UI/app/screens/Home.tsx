import { useState, useEffect } from 'react';
import { Search, Bell, Flame, Clock, ChevronRight, MapPin, Star, Utensils } from 'lucide-react';
import { useNavigate } from 'react-router';
import { FoodCard } from '../components/FoodCard';
import { menuItems, MenuItem } from '../data/menuItems';
import { BottomNav } from '../components/BottomNav';
import { motion, AnimatePresence } from 'motion/react';

const categories = [
  { name: 'All', emoji: '🍽️' },
  { name: 'South Indian', emoji: '🥘' },
  { name: 'North Indian', emoji: '🍛' },
  { name: 'Snacks', emoji: '🍟' },
  { name: 'Indo-Chinese', emoji: '🥟' },
  { name: 'Beverages', emoji: '☕' },
  { name: 'Bakery', emoji: '🧁' },
];

export function Home() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState<{ item: MenuItem; quantity: number }[]>([]);
  const [timeLeft, setTimeLeft] = useState(38);
  const [vegOnly, setVegOnly] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 60));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  let filteredItems = selectedCategory === 'All'
    ? menuItems
    : menuItems.filter(item => item.category === selectedCategory);

  if (vegOnly) {
    filteredItems = filteredItems.filter(item => item.isVeg);
  }

  const handleAddToCart = (item: MenuItem) => {
    const existingItem = cart.find(c => c.item.id === item.id);
    if (existingItem) {
      setCart(cart.map(c =>
        c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
      ));
    } else {
      setCart([...cart, { item, quantity: 1 }]);
    }
  };

  const handleQuantityChange = (itemId: string, delta: number) => {
    setCart(cart.map(c => {
      if (c.item.id === itemId) {
        const newQuantity = Math.max(0, c.quantity + delta);
        return newQuantity === 0 ? null : { ...c, quantity: newQuantity };
      }
      return c;
    }).filter(Boolean) as { item: MenuItem; quantity: number }[]);
  };

  const getQuantity = (itemId: string) => {
    return cart.find(c => c.item.id === itemId)?.quantity || 0;
  };

  const cartTotal = cart.reduce((sum, c) => sum + (c.item.price * c.quantity), 0);
  const cartItemCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-28">
      {/* Header */}
      <header className="bg-[#8B1A1A] px-4 pt-3 pb-4 sticky top-0 z-40">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-1.5">
                <MapPin size={14} className="text-white/70" />
                <span className="text-white/70 text-xs">PICKUP FROM</span>
              </div>
              <h1 className="text-white flex items-center gap-1" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '18px' }}>
                NRI Canteen
                <ChevronRight size={16} className="text-white/60" />
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button className="w-9 h-9 bg-white/15 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Search size={18} className="text-white" />
              </button>
              <button className="w-9 h-9 bg-white/15 rounded-full flex items-center justify-center backdrop-blur-sm relative">
                <Bell size={18} className="text-white" />
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#F5821F] rounded-full border-2 border-[#8B1A1A]" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto">
        {/* Lunch Rush Banner */}
        <div className="px-4 -mt-0">
          <div className="bg-gradient-to-r from-[#F5821F] to-[#FF9F43] rounded-2xl p-4 mt-4 text-white flex items-center justify-between relative overflow-hidden" style={{ boxShadow: '0 8px 24px rgba(245,130,31,0.3)' }}>
            <div className="absolute right-0 top-0 bottom-0 w-24 opacity-10">
              <Utensils size={80} className="absolute -right-4 top-1/2 -translate-y-1/2 rotate-12" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <Flame size={18} className="text-yellow-200" />
                <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '16px' }}>Lunch Rush</span>
              </div>
              <p className="text-sm text-white/85">Order now before the queue builds up!</p>
            </div>
            <div className="relative z-10 bg-white/20 rounded-xl px-3 py-2 backdrop-blur-sm text-center">
              <div className="text-2xl" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}>{timeLeft}</div>
              <div className="text-[10px] text-white/80 tracking-wider">MINS LEFT</div>
            </div>
          </div>
        </div>

        {/* Veg/Non-veg toggle + Category Filters */}
        <div className="px-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setVegOnly(!vegOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${
                vegOnly
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
              style={{ fontWeight: 600 }}
            >
              <div className="w-3 h-3 border-2 border-green-600 rounded-sm flex items-center justify-center bg-white">
                <div className="w-1.5 h-1.5 rounded-full bg-green-600" />
              </div>
              Veg Only
            </button>
            <div className="h-4 w-px bg-gray-300" />
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock size={12} />
              <span>Quick bites in 5-15 mins</span>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
            {categories.map((category) => (
              <button
                key={category.name}
                onClick={() => setSelectedCategory(category.name)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm whitespace-nowrap transition-all ${
                  selectedCategory === category.name
                    ? 'bg-[#8B1A1A] text-white shadow-md'
                    : 'bg-white text-gray-700'
                }`}
                style={{
                  fontWeight: selectedCategory === category.name ? 600 : 500,
                  boxShadow: selectedCategory !== category.name ? '0 1px 4px rgba(0,0,0,0.06)' : undefined,
                }}
              >
                <span>{category.emoji}</span>
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Section Header */}
        <div className="px-4 mt-2 mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-gray-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '18px' }}>
              {selectedCategory === 'All' ? 'Lunch Specials' : selectedCategory}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {filteredItems.length} items available
            </p>
          </div>
          <div className="flex items-center gap-1 text-[#F5821F]">
            <Star size={14} className="fill-[#F5821F]" />
            <span className="text-xs" style={{ fontWeight: 600 }}>Bestsellers</span>
          </div>
        </div>

        {/* Menu List */}
        <div className="px-4 space-y-3">
          <AnimatePresence>
            {filteredItems.map((item) => (
              <FoodCard
                key={item.id}
                item={item}
                onAdd={handleAddToCart}
                quantity={getQuantity(item.id)}
                onQuantityChange={handleQuantityChange}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Sticky Cart Bar */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.button
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={() => navigate('/cart', { state: { cart } })}
            className="fixed bottom-[72px] left-4 right-4 max-w-[343px] mx-auto z-40 bg-[#8B1A1A] text-white py-3.5 rounded-2xl flex items-center justify-between px-5 overflow-hidden"
            style={{ boxShadow: '0 8px 32px rgba(139,26,26,0.4)' }}
          >
            <div className="flex items-center gap-2">
              <div className="bg-white/20 rounded-lg px-2 py-0.5 text-sm" style={{ fontWeight: 700 }}>
                {cartItemCount}
              </div>
              <div className="text-left">
                <div className="text-xs text-white/70">
                  {cartItemCount} {cartItemCount === 1 ? 'ITEM' : 'ITEMS'} ADDED
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>₹{cartTotal}</span>
              <ChevronRight size={18} />
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
