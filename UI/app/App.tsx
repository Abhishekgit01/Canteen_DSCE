import { RouterProvider } from 'react-router';
import { router } from './routes';

export default function App() {
  return (
    <div className="antialiased min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="w-full max-w-[375px] min-h-screen bg-[#FAF8F5] shadow-2xl relative overflow-hidden">
        <RouterProvider router={router} />
      </div>
    </div>
  );
}