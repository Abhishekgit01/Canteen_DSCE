import './config/env.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { DEFAULT_COLLEGE } from './config/college.js';
import { User, MenuItem } from './models/index.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/canteen';

const menuItems = [
  // MEALS
  {
    name: 'Masala Dosa',
    description: 'Crispy rice crepe filled with spiced potato filling, served with coconut chutney and sambar',
    imageUrl: 'https://dummyimage.com/400x300/1e2640/f97316.png&text=Masala+Dosa',
    price: 55,
    calories: 350,
    category: 'meals',
    tempOptions: ['normal', 'hot'],
    isAvailable: true,
    preparationMinutes: 12,
  },
  {
    name: 'Idli Sambar (3pc)',
    description: 'Steamed rice cakes served with lentil soup and coconut chutney',
    imageUrl: 'https://dummyimage.com/400x300/1e2640/f97316.png&text=Idli+Sambar',
    price: 40,
    calories: 280,
    category: 'meals',
    tempOptions: ['normal', 'hot'],
    isAvailable: true,
    preparationMinutes: 8,
  },
  {
    name: 'Veg Fried Rice',
    description: 'Wok-tossed rice with fresh vegetables and Indo-Chinese spices',
    imageUrl: 'https://dummyimage.com/400x300/1e2640/f97316.png&text=Veg+Fried+Rice',
    price: 70,
    calories: 450,
    category: 'meals',
    tempOptions: ['normal', 'hot'],
    isAvailable: true,
    preparationMinutes: 15,
  },
  {
    name: 'Chicken Biryani',
    description: 'Fragrant basmati rice layered with tender spiced chicken, served with raita',
    imageUrl: 'https://dummyimage.com/400x300/1e2640/f97316.png&text=Chicken+Biryani',
    price: 110,
    calories: 620,
    category: 'meals',
    tempOptions: ['normal', 'hot'],
    isAvailable: true,
    preparationMinutes: 20,
  },
  {
    name: 'Chapati with Curry (3pc)',
    description: 'Soft whole wheat flatbreads served with seasonal vegetable curry',
    imageUrl: 'https://dummyimage.com/400x300/1e2640/f97316.png&text=Chapati+with+Curry',
    price: 50,
    calories: 380,
    category: 'meals',
    tempOptions: ['normal', 'hot'],
    isAvailable: true,
    preparationMinutes: 10,
  },

  // SNACKS
  {
    name: 'Samosa (2pc)',
    description: 'Crispy golden pastry stuffed with spiced potato and peas',
    imageUrl: 'https://dummyimage.com/400x300/1e2640/f97316.png&text=Samosa',
    price: 20,
    calories: 180,
    category: 'snacks',
    tempOptions: ['normal', 'hot'],
    isAvailable: true,
    preparationMinutes: 5,
  },
  {
    name: 'Veg Puff',
    description: 'Flaky puff pastry with spiced vegetable filling',
    imageUrl: 'https://dummyimage.com/400x300/1e2640/f97316.png&text=Veg+Puff',
    price: 18,
    calories: 220,
    category: 'snacks',
    tempOptions: ['normal', 'hot'],
    isAvailable: true,
    preparationMinutes: 5,
  },
  {
    name: 'French Fries',
    description: 'Crispy golden fries seasoned with salt and spices',
    imageUrl: 'https://dummyimage.com/400x300/1e2640/f97316.png&text=French+Fries',
    price: 60,
    calories: 310,
    category: 'snacks',
    tempOptions: ['normal', 'hot'],
    isAvailable: true,
    preparationMinutes: 8,
  },
  {
    name: 'Bread Omelette',
    description: 'Fluffy egg omelette sandwiched in buttered toast',
    imageUrl: 'https://dummyimage.com/400x300/1e2640/f97316.png&text=Bread+Omelette',
    price: 35,
    calories: 290,
    category: 'snacks',
    tempOptions: ['normal', 'hot'],
    isAvailable: true,
    preparationMinutes: 7,
  },

  // BEVERAGES
  {
    name: 'Filter Coffee',
    description: 'Traditional South Indian filter coffee brewed fresh',
    imageUrl: 'https://dummyimage.com/400x300/1e2640/f97316.png&text=Filter+Coffee',
    price: 20,
    calories: 80,
    category: 'beverages',
    tempOptions: ['hot'],
    isAvailable: true,
    preparationMinutes: 3,
  },
  {
    name: 'Cold Coffee',
    description: 'Chilled coffee blended with ice cream and milk',
    imageUrl: 'https://dummyimage.com/400x300/1e2640/f97316.png&text=Cold+Coffee',
    price: 45,
    calories: 180,
    category: 'beverages',
    tempOptions: ['cold'],
    isAvailable: true,
    preparationMinutes: 4,
  },
  {
    name: 'Fresh Lime Soda',
    description: 'Refreshing lime juice mixed with chilled soda water',
    imageUrl: 'https://dummyimage.com/400x300/1e2640/f97316.png&text=Fresh+Lime+Soda',
    price: 30,
    calories: 60,
    category: 'beverages',
    tempOptions: ['cold'],
    isAvailable: true,
    preparationMinutes: 3,
  },
  {
    name: 'Masala Chai',
    description: 'Spiced tea brewed with ginger, cardamom, and milk',
    imageUrl: 'https://dummyimage.com/400x300/1e2640/f97316.png&text=Masala+Chai',
    price: 15,
    calories: 70,
    category: 'beverages',
    tempOptions: ['hot'],
    isAvailable: true,
    preparationMinutes: 3,
  },

  // DESSERTS
  {
    name: 'Gulab Jamun (2pc)',
    description: 'Soft deep-fried milk dumplings soaked in cardamom-infused sugar syrup',
    imageUrl: 'https://dummyimage.com/400x300/1e2640/f97316.png&text=Gulab+Jamun',
    price: 30,
    calories: 210,
    category: 'desserts',
    tempOptions: ['cold', 'normal', 'hot'],
    isAvailable: true,
    preparationMinutes: 2,
  },
];

const collegeMenuItems = (college: 'DSCE' | 'NIE') => menuItems.map((item) => ({ ...item, college }));

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Drop existing database entirely to allow fresh seeding
    await mongoose.connection.db?.dropDatabase();
    console.log('Dropped existing db to re-seed.');

    const userCount = await User.countDocuments();
    const menuCount = await MenuItem.countDocuments();

    if (userCount > 0 && menuCount > 0) {
      console.log(`Database already has ${userCount} users and ${menuCount} menu items. Skipping seed.`);
      console.log('To reseed, drop the database first: db.dropDatabase()');
      process.exit(0);
    }

    // Create users if none exist
    if (userCount === 0) {
      const salt = await bcrypt.genSalt(12);
      await User.create([
        { name: 'Admin User', email: 'admin@dsce.edu.in', passwordHash: await bcrypt.hash('Admin@123!', salt), usn: '1DS21CS001', role: 'admin', college: DEFAULT_COLLEGE, isVerified: true },
        { name: 'DSCE Manager', email: 'manager@dsce.edu.in', passwordHash: await bcrypt.hash('Manager@123!', salt), usn: '1DS21CS002', role: 'manager', college: 'DSCE', isVerified: true },
        { name: 'DSCE Staff', email: 'staff@dsce.edu.in', passwordHash: await bcrypt.hash('Staff@123!', salt), usn: '1DS21CS003', role: 'staff', college: 'DSCE', isVerified: true },
        { name: 'DSCE Student', email: 'test@dsce.edu.in', passwordHash: await bcrypt.hash('Test@123!', salt), usn: '1DS21CS004', role: 'student', college: 'DSCE', isVerified: true },
        { name: 'NIE Manager', email: 'manager@nie.edu.in', passwordHash: await bcrypt.hash('Manager@123!', salt), usn: '4IK25CS900', role: 'manager', college: 'NIE', isVerified: true },
        { name: 'NIE Staff', email: 'staff@nie.edu.in', passwordHash: await bcrypt.hash('Staff@123!', salt), usn: '4IK25CS901', role: 'staff', college: 'NIE', isVerified: true },
        { name: 'NIE Student', email: 'test@nie.edu.in', passwordHash: await bcrypt.hash('Test@123!', salt), usn: '4IK25CS902', role: 'student', college: 'NIE', isVerified: true },
        { name: 'Demo User', email: 'demo@test.com', passwordHash: await bcrypt.hash('Demo@123!', salt), usn: '1DS21CS999', role: 'student', college: 'DSCE', isVerified: true },
      ]);
      console.log('✅ Created multi-college seed users:');
      console.log('   admin@dsce.edu.in / Admin@123! (admin)');
      console.log('   manager@dsce.edu.in / Manager@123! (DSCE manager)');
      console.log('   staff@dsce.edu.in / Staff@123! (DSCE staff)');
      console.log('   test@dsce.edu.in / Test@123! (DSCE student)');
      console.log('   manager@nie.edu.in / Manager@123! (NIE manager)');
      console.log('   staff@nie.edu.in / Staff@123! (NIE staff)');
      console.log('   test@nie.edu.in / Test@123! (NIE student)');
      console.log('   demo@test.com / Demo@123! (DSCE student)');
    }

    // Create menu items if none exist
    if (menuCount === 0) {
      await MenuItem.insertMany([
        ...collegeMenuItems('DSCE'),
        ...collegeMenuItems('NIE'),
      ]);
      console.log(`✅ Created ${menuItems.length * 2} college-scoped menu items`);
    }

    console.log('\n🎉 Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
