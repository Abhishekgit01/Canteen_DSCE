import { Home, Search, ShoppingBag, User } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { motion } from 'motion/react';

export function BottomNav() {
  const location = useLocation();

  const navItems = [
    { icon: Home, label: 'CANTEEN', path: '/' },
    { icon: Search, label: 'SEARCH', path: '/search' },
    { icon: ShoppingBag, label: 'ORDERS', path: '/orders' },
    { icon: User, label: 'PROFILE', path: '/profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl z-50" style={{ boxShadow: '0 -4px 24px rgba(0,0,0,0.06)' }}>
      <div className="max-w-md mx-auto flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-col items-center gap-0.5 py-1 px-3 relative"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-[#F5821F] rounded-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-[#F5821F]/10' : ''}`}>
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  className={`transition-colors ${isActive ? 'text-[#F5821F]' : 'text-gray-400'}`}
                />
              </div>
              <span className={`text-[10px] tracking-wider transition-colors ${isActive ? 'text-[#F5821F]' : 'text-gray-400'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
      {/* Safe area padding for mobile */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
