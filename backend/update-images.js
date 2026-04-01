import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const MONGO_URI = process.env.MONGO_URI;

// Define a simple schema matched to the collection
const menuSchema = new mongoose.Schema({
  name: String,
  imageUrl: String,
}, { strict: false });

async function updateImages() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGO_URI);
    
    const MenuItem = mongoose.model('MenuItem', menuSchema, 'menuitems');
    
    // Find all menu items
    const items = await MenuItem.find({});
    console.log(`Found ${items.length} menu items.`);
    
    let updatedCount = 0;
    for (const item of items) {
      if (item.imageUrl && item.imageUrl.includes('placehold.co')) {
        // e.g. https://placehold.co/400x300/1e2640/f97316?text=Masala+Dosa
        const textMatch = item.imageUrl.match(/text=([^&]+)/);
        const text = textMatch ? textMatch[1] : item.name.replace(/\s+/g, '+');
        
        // Use dummyimage - Format: https://dummyimage.com/400x300/1e2640/f97316.png&text=Masala+Dosa
        const newUrl = `https://dummyimage.com/400x300/1e2640/f97316.png&text=${text}`;
        
        item.imageUrl = newUrl;
        await item.save();
        updatedCount++;
      }
    }
    
    console.log(`✅ Successfully updated ${updatedCount} image URLs.`);
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit(0);
  }
}

updateImages();
