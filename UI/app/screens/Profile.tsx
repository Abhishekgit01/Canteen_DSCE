import { User, Wallet, Heart, Settings, HelpCircle, LogOut, ChevronRight, Star } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';

const menuOptions = [
  { icon: Wallet, label: 'Campus Wallet', sublabel: 'Balance: ₹450', color: 'bg-[#8B1A1A]' },
  { icon: Heart, label: 'Favourites', sublabel: '5 items saved', color: 'bg-pink-500' },
  { icon: Star, label: 'Rewards', sublabel: '120 points', color: 'bg-[#F5821F]' },
  { icon: Settings, label: 'Settings', color: 'bg-gray-600' },
  { icon: HelpCircle, label: 'Help & Support', color: 'bg-blue-500' },
];

export function Profile() {
  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-24">
      <div className="max-w-md mx-auto px-4 pt-6">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl p-5 mb-4 flex items-center gap-4" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          <div className="w-14 h-14 bg-[#8B1A1A] rounded-full flex items-center justify-center">
            <span className="text-white text-xl" style={{ fontWeight: 700 }}>RS</span>
          </div>
          <div className="flex-1">
            <h2 className="text-gray-900" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '17px' }}>Rahul Sharma</h2>
            <p className="text-xs text-gray-500">4th Sem · CS Engineering</p>
            <p className="text-xs text-gray-400">rahul.s@dsu.edu.in</p>
          </div>
        </div>

        {/* Menu */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          {menuOptions.map((opt, i) => {
            const Icon = opt.icon;
            return (
              <button key={opt.label} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
                <div className={`w-8 h-8 ${opt.color} rounded-lg flex items-center justify-center`}>
                  <Icon size={16} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900" style={{ fontWeight: 600 }}>{opt.label}</p>
                  {opt.sublabel && <p className="text-xs text-gray-500">{opt.sublabel}</p>}
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
            );
          })}
        </div>

        <button className="w-full flex items-center justify-center gap-2 mt-4 py-3 text-red-500 text-sm" style={{ fontWeight: 600 }}>
          <LogOut size={16} /> Sign Out
        </button>
      </div>
      <BottomNav />
    </div>
  );
}
