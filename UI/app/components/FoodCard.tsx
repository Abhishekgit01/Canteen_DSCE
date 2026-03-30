import { Plus, Minus, Star } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MenuItem } from '../data/menuItems';

interface FoodCardProps {
  item: MenuItem;
  onAdd: (item: MenuItem) => void;
  size?: 'normal' | 'small';
  quantity?: number;
  onQuantityChange?: (itemId: string, delta: number) => void;
}

export function FoodCard({ item, onAdd, size = 'normal', quantity = 0, onQuantityChange }: FoodCardProps) {
  const isSmall = size === 'small';
  const [imgLoaded, setImgLoaded] = useState(false);

  if (isSmall) {
    return (
      <div className="flex-shrink-0 w-[130px]">
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div className="relative h-[90px]">
            <img
              src={item.image}
              alt={item.name}
              className="w-full h-full object-cover"
              onLoad={() => setImgLoaded(true)}
            />
            <div className="absolute top-1.5 right-1.5">
              <VegIndicator isVeg={item.isVeg} small />
            </div>
            <button
              onClick={() => onAdd(item)}
              className="absolute bottom-2 right-2 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform"
            >
              <Plus size={14} className="text-[#F5821F]" />
            </button>
          </div>
          <div className="p-2.5">
            <h3 className="text-xs text-gray-900 line-clamp-1" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>{item.name}</h3>
            <p className="text-sm text-gray-900 mt-0.5" style={{ fontWeight: 600 }}>₹{item.price}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl overflow-hidden"
      style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.05)' }}
    >
      <div className="flex gap-3 p-3">
        {/* Text content */}
        <div className="flex-1 min-w-0 py-1">
          <div className="flex items-center gap-1.5 mb-1">
            <VegIndicator isVeg={item.isVeg} />
            {item.badge && (
              <span className="text-[10px] px-1.5 py-0.5 bg-[#F5821F]/10 text-[#F5821F] rounded" style={{ fontWeight: 600 }}>
                {item.badge}
              </span>
            )}
          </div>
          <h3 className="text-gray-900 line-clamp-2 mb-1" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px' }}>
            {item.name}
          </h3>
          <p className="text-xs text-gray-500 line-clamp-2 mb-2">{item.description}</p>
          <div className="flex items-center gap-2">
            <span className="text-gray-900" style={{ fontWeight: 700, fontSize: '16px' }}>₹{item.price}</span>
            {item.rating && (
              <span className="flex items-center gap-0.5 text-xs text-gray-500">
                <Star size={11} className="text-[#F5821F] fill-[#F5821F]" />
                {item.rating}
              </span>
            )}
          </div>
        </div>

        {/* Image + Add button */}
        <div className="relative flex-shrink-0 w-[110px]">
          <div className="w-[110px] h-[100px] rounded-xl overflow-hidden">
            <img
              src={item.image}
              alt={item.name}
              className="w-full h-full object-cover"
              onLoad={() => setImgLoaded(true)}
            />
          </div>
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
            <AnimatePresence mode="wait">
              {quantity > 0 ? (
                <motion.div
                  key="stepper"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="flex items-center bg-[#F5821F] rounded-lg overflow-hidden shadow-lg"
                >
                  <button
                    onClick={() => onQuantityChange?.(item.id, -1)}
                    className="w-8 h-8 flex items-center justify-center text-white hover:bg-[#E67316] transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center text-white text-sm" style={{ fontWeight: 700 }}>{quantity}</span>
                  <button
                    onClick={() => onQuantityChange?.(item.id, 1)}
                    className="w-8 h-8 flex items-center justify-center text-white hover:bg-[#E67316] transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </motion.div>
              ) : (
                <motion.button
                  key="add"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  onClick={() => onAdd(item)}
                  className="bg-white border border-gray-200 text-[#F5821F] px-5 py-1.5 rounded-lg shadow-md hover:shadow-lg transition-all"
                  style={{ fontWeight: 700, fontSize: '13px' }}
                >
                  ADD
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function VegIndicator({ isVeg, small = false }: { isVeg: boolean; small?: boolean }) {
  const size = small ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const dotSize = small ? 'w-1.5 h-1.5' : 'w-2 h-2';
  return (
    <div className={`${size} border-2 ${isVeg ? 'border-green-600' : 'border-red-500'} rounded-sm flex items-center justify-center bg-white`}>
      <div className={`${dotSize} rounded-full ${isVeg ? 'bg-green-600' : 'bg-red-500'}`} />
    </div>
  );
}
