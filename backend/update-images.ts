import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { MenuItem } from './src/models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/canteen';

const REAL_IMAGES = {
  'Masala Dosa': 'https://images.unsplash.com/photo-1589301760014-d929f39ce9b1?q=80&w=800&auto=format&fit=crop',
  'Idli Vada': 'https://images.unsplash.com/photo-1589301760014-d929f39ce9b1?q=80&w=800&auto=format&fit=crop', // Re-using dosa pic for now unless specific
  'Veg Pulao': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=800&auto=format&fit=crop',
  'Paneer Butter Masala': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc0?q=80&w=800&auto=format&fit=crop',
  'Samosa (2 pcs)': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?q=80&w=800&auto=format&fit=crop',
  'Veg Puff': 'https://images.unsplash.com/photo-1628840042765-356cda07504e?q=80&w=800&auto=format&fit=crop',
  'Filter Coffee': 'https://images.unsplash.com/photo-1579992357154-faf4bde95b3d?q=80&w=800&auto=format&fit=crop',
  'Cold Coffee': 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?q=80&w=800&auto=format&fit=crop',
  'Fresh Lime Soda': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=800&auto=format&fit=crop',
  'Gulab Jamun': 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?q=80&w=800&auto=format&fit=crop'
};

const GENERIC_IMG = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=800&auto=format&fit=crop';

async function updateImages() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const items = await MenuItem.find({});
    for (const item of items) {
      if (!item.isFeatured) item.isFeatured = false;
      const newImg = REAL_IMAGES[item.name] || GENERIC_IMG;
      item.imageUrl = newImg;
      await item.save();
    }
    console.log(`Updated ${items.length} images to real Unsplash photos!`);

  } catch (err) {
    console.error('Error updating images:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}

updateImages();
