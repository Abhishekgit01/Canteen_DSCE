import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, User } from './api';
import { socketClient } from './socket';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; name: string; rollNumber: string; semester: string; department: string }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = api.getToken();
      if (token) {
        try {
          const userData = await api.getMe();
          setUser(userData);
          await socketClient.connect(userData.id);
        } catch {
          api.setToken(null);
        }
      }
      setIsLoading(false);
    };
    initAuth();

    return () => {
      socketClient.disconnect();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { user: userData } = await api.login(email, password);
    setUser(userData);
    await socketClient.connect(userData.id);
  };

  const register = async (data: { email: string; password: string; name: string; rollNumber: string; semester: string; department: string }) => {
    const { user: userData } = await api.register(data);
    setUser(userData);
    await socketClient.connect(userData.id);
  };

  const logout = () => {
    api.setToken(null);
    setUser(null);
    socketClient.disconnect();
  };

  const refreshUser = async () => {
    if (api.getToken()) {
      const userData = await api.getMe();
      setUser(userData);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
