import path from 'path';
import dotenv from 'dotenv';

// Load backend/.env before route modules read process.env during import.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
