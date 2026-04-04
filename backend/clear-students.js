import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
const MONGO_URI = process.env.MONGO_URI;

async function clear() {
  try {
    await mongoose.connect(MONGO_URI);
    // Delete all users whose role is 'student'
    const result = await mongoose.connection.collection('users').deleteMany({ role: 'student' });
    console.log(`🧹 Deleted ${result.deletedCount} student users.`);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
clear();
