import { useState } from 'react';
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../lib/auth-context';

export function Login() {
  const navigate = useNavigate();
  const { login, isLoading: authLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    rollNumber: '',
    semester: '',
    department: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        navigate('/');
      } else {
        // Registration would go here
        setError('Registration coming soon. Use demo: rahul.s@dsu.edu.in with any password');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Header */}
      <header className="bg-[#8B1A1A] px-4 pt-3 pb-6">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/')} className="w-9 h-9 bg-white/15 rounded-full flex items-center justify-center">
            <ArrowLeft size={20} className="text-white" />
          </button>
          <h1 className="text-white" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '17px' }}>
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-6">
        {/* Demo Credentials */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-orange-800">
            <strong>Demo Account:</strong><br />
            Email: rahul.s@dsu.edu.in<br />
            Password: any password
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">Email</label>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter your email"
                className="w-full bg-white rounded-xl pl-11 pr-4 py-3.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none border border-gray-200 focus:border-[#8B1A1A]"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter your password"
                className="w-full bg-white rounded-xl pl-11 pr-11 py-3.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none border border-gray-200 focus:border-[#8B1A1A]"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#8B1A1A] to-[#A02020] text-white py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '15px' }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        {/* Toggle */}
        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-[#8B1A1A]"
            style={{ fontWeight: 600 }}
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
