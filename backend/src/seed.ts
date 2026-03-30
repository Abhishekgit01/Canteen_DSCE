import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, MenuItem } from './models/index.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/canteen';

const menuItems = [
  {
    name: 'Masala Dosa',
    description: 'Crispy rice crepe filled with spiced potato filling',
    imageUrl: 'https://images.unsplash.com/photo-1589301760015-d7a276c9743a?w=400',
    price: 60,
    calories: 350,
    category: 'meals',
    tempOptions: ['normal', 'hot'],
    isAvailable: true,
  },
  {
    name: 'Idli Sambar',
    description: 'Steamed rice cakes with lentil soup',
    imageUrl: 'https://images.unsplash.com/photo-1588137372308-15f75323ca8d?w=400',
    price: 40,
    calories: 200,
    category: 'meals',
    tempOptions: ['normal', 'hot'],
    isAvailable: true,
  },
  {
    name: 'Vada Pav',
    description: 'Spiced potato fritter in a bun',
    imageUrl: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400',
    price: 30,
    calories: 280,
    category: 'snacks',
    tempOptions: ['normal', 'hot'],
    isAvailable: true,
  },
  {
    name: 'Samosa',
    description: 'Crispy pastry filled with spiced potatoes',
    imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400',
    price: 25,
    calories: 220,
    category: 'snacks',
    tempOptions: ['normal', 'hot'],
    isAvailable: true,
  },
  {
    name: 'Cold Coffee',
    description: 'Chilled coffee with ice cream',
    imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b5dd7359?w=400',
    price: 50,
    calories: 180,
    category: 'beverages',
    tempOptions: ['cold'],
    isAvailable: true,
  },
  {
    name: 'Masala Chai',
    description: 'Spiced tea with milk',
    imageUrl: 'https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?w=400',
    price: 20,
    calories: 80,
    category: 'beverages',
    tempOptions: ['cold', 'hot'],
    isAvailable: true,
  },
  {
    name: 'Gulab Jamun',
    description: 'Sweet milk solids in sugar syrup',
    imageUrl: 'https://images.unsplash.com/photo-1601308578847-256025cd894e?w=400',
    price: 35,
    calories: 250,
    category: 'desserts',
    tempOptions: ['normal', 'hot'],
    isAvailable: true,
  },
  {
    name: 'Rasmalai',
    description: 'Creamy cottage cheese patties in sweetened milk',
    imageUrl: 'https://images.unsplash.com/photo-1623653387945-2fd25214e8df?w=400',
    price: 45,
    calories: 220,
    category: 'desserts',
    tempOptions: ['cold'],
    isAvailable: true,
  },
  {
    name: 'Biryani',
    description: 'Fragrant rice with spiced vegetables',
    imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400',
    price: 120,
    calories: 450,
    category: 'meals',
    tempOptions: ['normal', 'hot'],
    isAvailable: true,
  },
  {
    name: 'Pav Bhaji',
    description: 'Spiced vegetable mash with buttered buns',
    imageUrl: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400',
    price: 80,
    calories: 380,
    category: 'meals',
    tempOptions: ['normal', 'hot'],
    isAvailable: true,
  },
  {
    name: 'Fresh Juice',
    description: 'Assorted fruit juices',
    imageUrl: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400',
    price: 40,
    calories: 120,
    category: 'beverages',
    tempOptions: ['cold'],
    isAvailable: true,
  },
  {
    name: 'Sandwich',
    description: 'Grilled vegetable sandwich',
    imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400',
    price: 55,
    calories: 300,
    category: 'snacks',
    tempOptions: ['normal'],
    isAvailable: true,
  },
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await MenuItem.deleteMany({});

    // Create admin user
    const adminPassword = await bcrypt.hash('Admin@123', 12);
    const admin = new User({
      usn: 'ADMIN001',
      email: 'admin@dsce.edu.in',
      passwordHash: adminPassword,
      name: 'Admin User',
      role: 'admin',
      isVerified: true,
    });
    await admin.save();
    console.log('Created admin user: admin@dsce.edu.in / Admin@123');

    // Create manager user
    const managerPassword = await bcrypt.hash('Manager@123', 12);
    const manager = new User({
      usn: 'MGR001',
      email: 'manager@dsce.edu.in',
      passwordHash: managerPassword,
      name: 'Manager User',
      role: 'manager',
      isVerified: true,
    });
    await manager.save();
    console.log('Created manager user: manager@dsce.edu.in / Manager@123');

    // Create staff user
    const staffPassword = await bcrypt.hash('Staff@123', 12);
    const staff = new User({
      usn: 'STAFF001',
      email: 'staff@dsce.edu.in',
      passwordHash: staffPassword,
      name: 'Staff User',
      role: 'staff',
      isVerified: true,
    });
    await staff.save();
    console.log('Created staff user: staff@dsce.edu.in / Staff@123');

    // Create menu items
    for (const item of menuItems) {
      await MenuItem.create(item);
    }
    console.log(`Created ${menuItems.length} menu items`);

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
