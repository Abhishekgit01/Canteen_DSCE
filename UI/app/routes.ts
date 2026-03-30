import { createBrowserRouter } from 'react-router';
import { Home } from './screens/Home';
import { Cart } from './screens/Cart';
import { OrderTracking } from './screens/OrderTracking';
import { Search } from './screens/Search';
import { Orders } from './screens/Orders';
import { Profile } from './screens/Profile';

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
]);
