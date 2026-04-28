
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const collections = [
  'users', 'causes', 'notices', 'bookings', 'maintenance', 
  'market', 'visitors', 'feedback', 'anonymous_reports', 
  'polls', 'posts', 'photos', 'files'
];

async function countAll() {
  try {
    for (const col of collections) {
      try {
        const { count, error } = await supabase
          .from(col)
          .select('*', { count: 'exact', head: true });
        
        if (error) throw error;
        console.log(`${col}: ${count}`);
      } catch (e) {
        console.log(`${col}: Error or Permission Denied`);
      }
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

countAll();
