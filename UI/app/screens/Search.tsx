import { useState } from 'react';
import { Search as SearchIcon, TrendingUp, Clock, X } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { menuItems } from '../data/menuItems';

const recentSearches = ['Maggi', 'Biryani', 'Cold Coffee'];
const trendingItems = ['Masala Dosa', 'Chicken Biryani', 'Cheese Maggi', 'Veg Momos', 'Cutting Chai'];

export function Search() {
  const [query, setQuery] = useState('');
  const results = query.length > 1
    ? menuItems.filter(item => item.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-24">
      <div className="max-w-md mx-auto px-4 pt-4">
        {/* Search Bar */}
        <div className="relative mb-6">
          <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for dishes, cuisines..."
            className="w-full bg-white rounded-2xl pl-11 pr-10 py-3.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none"
            style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2">
              <X size={16} className="text-gray-400" />
            </button>
          )}
        </div>

        {query.length > 1 ? (
          <div className="space-y-2">
            {results.map(item => (
              <div key={item.id} className="flex items-center gap-3 bg-white rounded-xl p-3" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover" />
                <div className="flex-1">
                  <p className="text-sm text-gray-900" style={{ fontWeight: 600 }}>{item.name}</p>
                  <p className="text-xs text-gray-500">₹{item.price} · {item.category}</p>
                </div>
              </div>
            ))}
            {results.length === 0 && (
              <p className="text-center text-gray-500 text-sm py-8">No results found for "{query}"</p>
            )}
          </div>
        ) : (
          <>
            {/* Recent */}
            <div className="mb-6">
              <h3 className="text-gray-900 mb-3" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '15px' }}>Recent Searches</h3>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map(s => (
                  <button key={s} onClick={() => setQuery(s)} className="flex items-center gap-1.5 bg-white px-3 py-2 rounded-full text-sm text-gray-700" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <Clock size={13} className="text-gray-400" /> {s}
                  </button>
                ))}
              </div>
            </div>
            {/* Trending */}
            <div>
              <h3 className="text-gray-900 mb-3" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '15px' }}>Trending Now</h3>
              {trendingItems.map((item, i) => (
                <button key={item} onClick={() => setQuery(item)} className="flex items-center gap-3 py-2.5 w-full">
                  <div className="w-6 h-6 bg-[#F5821F]/10 rounded-full flex items-center justify-center">
                    <TrendingUp size={12} className="text-[#F5821F]" />
                  </div>
                  <span className="text-sm text-gray-700" style={{ fontWeight: 500 }}>{item}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
