import { v4 as uuidv4 } from 'uuid';
import { User, MenuItem, Order, OrderStatus } from '../types/index.js';

// In-memory database (replace with PostgreSQL/MongoDB in production)
class Database {
  private users: Map<string, User> = new Map();
  private menuItems: Map<string, MenuItem> = new Map();
  private orders: Map<string, Order> = new Map();
  private ordersByUser: Map<string, string[]> = new Map();

  constructor() {
    this.seedData();
  }

  private seedData() {
    // Seed menu items
    const menuData: Omit<MenuItem, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'Masala Dosa',
        description: 'Crispy rice crepe with spiced potato filling, served with coconut chutney & sambar',
        price: 45,
        category: 'South Indian',
        isVeg: true,
        image: 'https://images.unsplash.com/photo-1694849789325-914b71ab4075?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmRpYW4lMjBtYXNhbGElMjBkb3NhJTIwY3Jpc3B5fGVufDF8fHx8MTc3NDc5OTIzOHww&ixlib=rb-4.1.0&q=80&w=1080',
        badge: 'BESTSELLER',
        canteen: 'NRI Canteen',
        rating: 4.5,
        prepTime: 8,
        isAvailable: true,
      },
      {
        name: 'Egg Puff',
        description: 'Flaky golden pastry with spiced boiled egg filling',
        price: 20,
        category: 'Bakery',
        isVeg: false,
        image: 'https://images.unsplash.com/photo-1759044752761-2b990e30c3e6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlZ2clMjBwdWZmJTIwcGFzdHJ5fGVufDF8fHx8MTc3NDc5ODc3MXww&ixlib=rb-4.1.0&q=80&w=1080',
        badge: 'POPULAR',
        canteen: 'NRI Canteen',
        rating: 4.3,
        prepTime: 3,
        isAvailable: true,
      },
      {
        name: 'Cheese Maggi',
        description: 'Loaded instant noodles with extra cheese, veggies & special masala',
        price: 60,
        category: 'Snacks',
        isVeg: true,
        image: 'https://images.unsplash.com/photo-1722032393693-691b59565eaf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGVlc2UlMjBtYWdnaSUyMG5vb2RsZXN8ZW58MXx8fHwxNzc0Nzk4NzcyfDA&ixlib=rb-4.1.0&q=80&w=1080',
        badge: 'STUDENT FAV',
        canteen: 'NRI Canteen',
        rating: 4.6,
        prepTime: 10,
        isAvailable: true,
      },
      {
        name: 'Veg Momos (6 pcs)',
        description: 'Steamed vegetable dumplings with spicy red chutney',
        price: 70,
        category: 'Indo-Chinese',
        isVeg: true,
        image: 'https://images.unsplash.com/photo-1596768808824-d28bf6bd7e73?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2ZWclMjBtb21vcyUyMGR1bXBsaW5nc3xlbnwxfHx8fDE3NzQ3OTg3NzJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
        canteen: 'NRI Canteen',
        rating: 4.2,
        prepTime: 12,
        isAvailable: true,
      },
      {
        name: 'Chicken Biryani',
        description: 'Fragrant basmati rice layered with tender spiced chicken, served with raita',
        price: 110,
        category: 'North Indian',
        isVeg: false,
        image: 'https://images.unsplash.com/photo-1710143608680-6ed21d27fd82?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlja2VuJTIwYmlyeWFuaSUyMHBsYXRlfGVufDF8fHx8MTc3NDc5OTIzOHww&ixlib=rb-4.1.0&q=80&w=1080',
        badge: 'MUST TRY',
        canteen: 'NRI Canteen',
        rating: 4.7,
        prepTime: 15,
        isAvailable: true,
      },
      {
        name: 'Samosa (2 pcs)',
        description: 'Crispy golden pastry stuffed with spiced potato & peas',
        price: 25,
        category: 'Snacks',
        isVeg: true,
        image: 'https://images.unsplash.com/photo-1697155836252-d7f969108b5a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzYW1vc2ElMjBpbmRpYW4lMjBzbmFja3xlbnwxfHx8fDE3NzQ3MDkzNTR8MA&ixlib=rb-4.1.0&q=80&w=1080',
        canteen: 'NRI Canteen',
        rating: 4.1,
        prepTime: 5,
        isAvailable: true,
      },
      {
        name: 'Cutting Chai',
        description: 'Half cup of strong spiced tea — campus classic',
        price: 15,
        category: 'Beverages',
        isVeg: true,
        image: 'https://images.unsplash.com/photo-1759782177037-ea0b0879fb03?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjdXR0aW5nJTIwY2hhaSUyMHRlYXxlbnwxfHx8fDE3NzQ3OTg3NzR8MA&ixlib=rb-4.1.0&q=80&w=1080',
        canteen: 'NRI Canteen',
        rating: 4.8,
        prepTime: 3,
        isAvailable: true,
      },
      {
        name: 'Paneer Frankie',
        description: 'Spiced paneer wrapped in soft flatbread with tangy sauce',
        price: 75,
        category: 'Snacks',
        isVeg: true,
        image: 'https://images.unsplash.com/photo-1696960810804-5cf6f5689411?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmRpYW4lMjByb2xsJTIwd3JhcHxlbnwxfHx8fDE3NzQ3OTg3ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
        canteen: 'NRI Canteen',
        rating: 4.4,
        prepTime: 8,
        isAvailable: true,
      },
      {
        name: 'Idli Vada Combo',
        description: 'Soft steamed idlis with crispy vada, sambar & chutneys',
        price: 50,
        category: 'South Indian',
        isVeg: true,
        image: 'https://images.unsplash.com/photo-1743517894265-c86ab035adef?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYXNhbGElMjBkb3NhJTIwc291dGglMjBpbmRpYW58ZW58MXx8fHwxNzc0Nzc0OTY2fDA&ixlib=rb-4.1.0&q=80&w=1080',
        canteen: 'NRI Canteen',
        rating: 4.3,
        prepTime: 6,
        isAvailable: true,
      },
      {
        name: 'Gobi Manchurian',
        description: 'Crispy cauliflower tossed in spicy Indo-Chinese sauce',
        price: 65,
        category: 'Indo-Chinese',
        isVeg: true,
        image: 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlja2VuJTIwYmlyeWFuaSUyMGluZGlhbnxlbnwxfHx8fDE3NzQ2NzI3ODF8MA&ixlib=rb-4.1.0&q=80&w=1080',
        canteen: 'NRI Canteen',
        rating: 4.0,
        prepTime: 12,
        isAvailable: true,
      },
      {
        name: 'Bread Pakora',
        description: 'Fried bread with potato filling',
        price: 30,
        category: 'Snacks',
        isVeg: true,
        image: 'https://images.unsplash.com/photo-1756137949459-8aad8455d040?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxicmVhZCUyMHBha29yYSUyMGZyaWVkfGVufDF8fHx8MTc3NDc5ODc3NHww&ixlib=rb-4.1.0&q=80&w=1080',
        canteen: 'NRI Canteen',
        rating: 4.0,
        prepTime: 5,
        isAvailable: true,
      },
      {
        name: 'Cold Coffee',
        description: 'Chilled coffee with ice cream',
        price: 55,
        category: 'Beverages',
        isVeg: true,
        image: 'https://images.unsplash.com/photo-1625126626646-5f2af0894a77?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2xkJTIwY29mZmVlJTIwYmV2ZXJhZ2V8ZW58MXx8fHwxNzc0Nzk4Nzc0fDA&ixlib=rb-4.1.0&q=80&w=1080',
        canteen: 'NRI Canteen',
        rating: 4.5,
        prepTime: 3,
        isAvailable: true,
      },
      {
        name: 'Veg Puff',
        description: 'Flaky pastry with vegetable filling',
        price: 18,
        category: 'Bakery',
        isVeg: true,
        image: 'https://images.unsplash.com/photo-1589317169431-124b2fd668e3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2ZWclMjBwdWZmJTIwcGFzdHJ5fGVufDF8fHx8MTc3NDc5ODc3NXww&ixlib=rb-4.1.0&q=80&w=1080',
        canteen: 'NRI Canteen',
        rating: 4.2,
        prepTime: 3,
        isAvailable: true,
      },
    ];

    const now = new Date();
    menuData.forEach((item) => {
      const id = uuidv4();
      this.menuItems.set(id, {
        ...item,
        id,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Seed demo user
    const demoUserId = uuidv4();
    this.users.set(demoUserId, {
      id: demoUserId,
      email: 'rahul.s@dsu.edu.in',
      name: 'Rahul Sharma',
      rollNumber: 'CS2022001',
      semester: '4th Sem',
      department: 'CS Engineering',
      walletBalance: 450,
      rewardPoints: 120,
      createdAt: now,
      updatedAt: now,
    });

    // Demo password hash (password: "password123")
    this.userPasswords.set(demoUserId, '$2a$10$XOPbrlUPQdbwd0GsMJJm8OJZ8gJqZ8JqZ8JqZ8JqZ8JqZ8JqZ8JqZ');

    // Seed demo orders
    const order1Id = uuidv4();
    this.orders.set(order1Id, {
      id: order1Id,
      orderId: 'DSU2847',
      userId: demoUserId,
      items: [
        { itemId: '1', name: 'Masala Dosa', price: 45, quantity: 1, isVeg: true },
        { itemId: '7', name: 'Cutting Chai', price: 15, quantity: 1, isVeg: true },
      ],
      subtotal: 60,
      serviceFee: 2,
      discount: 0,
      total: 62,
      status: 'completed',
      paymentMethod: 'wallet',
      canteen: 'NRI Canteen',
      eta: 0,
      createdAt: new Date(Date.now() - 3600000),
      updatedAt: new Date(Date.now() - 3600000),
      completedAt: new Date(Date.now() - 1800000),
    });

    this.ordersByUser.set(demoUserId, [order1Id]);
  }

  // User passwords (separate from user data for security)
  private userPasswords: Map<string, string> = new Map();

  // User operations
  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  getUserByEmail(email: string): { user: User; passwordHash: string } | undefined {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return {
          user,
          passwordHash: this.userPasswords.get(user.id) || '',
        };
      }
    }
    return undefined;
  }

  createUser(data: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'walletBalance' | 'rewardPoints'> & { passwordHash: string }): User {
    const id = uuidv4();
    const now = new Date();
    const user: User = {
      id,
      email: data.email,
      name: data.name,
      rollNumber: data.rollNumber,
      semester: data.semester,
      department: data.department,
      walletBalance: 0,
      rewardPoints: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, user);
    this.userPasswords.set(id, data.passwordHash);
    return user;
  }

  updateUser(id: string, data: Partial<User>): User | undefined {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...data, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  updateUserPassword(id: string, passwordHash: string): boolean {
    if (!this.users.has(id)) return false;
    this.userPasswords.set(id, passwordHash);
    return true;
  }

  // Menu operations
  getAllMenuItems(): MenuItem[] {
    return Array.from(this.menuItems.values());
  }

  getMenuItem(id: string): MenuItem | undefined {
    return this.menuItems.get(id);
  }

  getMenuItemsByCategory(category: string): MenuItem[] {
    return this.getAllMenuItems().filter(item => item.category === category);
  }

  getCategories(): string[] {
    const categories = new Set(this.getAllMenuItems().map(item => item.category));
    return Array.from(categories);
  }

  // Order operations
  createOrder(data: Omit<Order, 'id' | 'orderId' | 'createdAt' | 'updatedAt'>): Order {
    const id = uuidv4();
    const orderId = 'DSU' + Math.floor(1000 + Math.random() * 9000);
    const now = new Date();
    const order: Order = {
      ...data,
      id,
      orderId,
      createdAt: now,
      updatedAt: now,
    };
    this.orders.set(id, order);

    // Add to user's orders
    const userOrders = this.ordersByUser.get(data.userId) || [];
    userOrders.push(id);
    this.ordersByUser.set(data.userId, userOrders);

    return order;
  }

  getOrder(id: string): Order | undefined {
    return this.orders.get(id);
  }

  getOrderByOrderId(orderId: string): Order | undefined {
    for (const order of this.orders.values()) {
      if (order.orderId === orderId) return order;
    }
    return undefined;
  }

  getOrdersByUser(userId: string): Order[] {
    const orderIds = this.ordersByUser.get(userId) || [];
    return orderIds
      .map(id => this.orders.get(id))
      .filter((o): o is Order => o !== undefined)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  updateOrderStatus(id: string, status: OrderStatus): Order | undefined {
    const order = this.orders.get(id);
    if (!order) return undefined;
    const updated: Order = {
      ...order,
      status,
      updatedAt: new Date(),
      ...(status === 'completed' ? { completedAt: new Date() } : {}),
    };
    this.orders.set(id, updated);
    return updated;
  }

  // Wallet operations
  deductWalletBalance(userId: string, amount: number): boolean {
    const user = this.users.get(userId);
    if (!user || user.walletBalance < amount) return false;
    user.walletBalance -= amount;
    user.updatedAt = new Date();
    this.users.set(userId, user);
    return true;
  }

  addWalletBalance(userId: string, amount: number): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    user.walletBalance += amount;
    user.updatedAt = new Date();
    this.users.set(userId, user);
    return true;
  }

  addRewardPoints(userId: string, points: number): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    user.rewardPoints += points;
    user.updatedAt = new Date();
    this.users.set(userId, user);
    return true;
  }
}

export const db = new Database();
