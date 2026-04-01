import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from './src/models/index.js';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/canteen').then(async () => {
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash('Demo@123!', salt);
    await User.updateOne({ email: 'demo@test.com' }, {
        $set: {
            name: 'Demo User',
            email: 'demo@test.com',
            passwordHash: hash,
            usn: '1DS21CS999',
            role: 'student',
            isVerified: true
        }
    }, { upsert: true });
    console.log('Upserted demo@test.com');
    process.exit(0);
});
