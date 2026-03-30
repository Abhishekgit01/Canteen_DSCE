import { createBrowserRouter } from 'react-router-dom';
import { Home } from './screens/Home';
import { Cart } from './screens/Cart';
import { OrderTracking } from './screens/OrderTracking';
import { Search } from './screens/Search';
import { Orders } from './screens/Orders';
import { Profile } from './screens/Profile';
import { Login } from './screens/Login';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Home,
  },
  {
    path: '/cart',
    Component: Cart,
  },
  {
    path: '/order-tracking',
    Component: OrderTracking,
  },
  {
    path: '/search',
    Component: Search,
  },
  {
    path: '/orders',
    Component: Orders,
  },
  {
    path: '/profile',
    Component: Profile,
  },
  {
    path: '/login',
    Component: Login,
  },
]);
