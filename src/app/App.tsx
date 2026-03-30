import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { AuthProvider } from '../lib/auth-context';

export default function App() {
  return (
    <AuthProvider>
      <div className="antialiased min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-full max-w-[375px] min-h-screen bg-[#FAF8F5] shadow-2xl relative overflow-hidden">
          <RouterProvider router={router} />
        </div>
      </div>
    </AuthProvider>
  );
}