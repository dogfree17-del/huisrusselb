import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAnonAccess() {
  console.log('--- Testing Anon Access to Supabase ---');
  
  const tables = ['notices', 'market', 'bookings', 'maintenance', 'users', 'stats'];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(`Table "${table}": ERROR (${error.message})`);
    } else {
      console.log(`Table "${table}": SUCCESS (Rows found: ${data?.length || 0})`);
    }
  }
}

testAnonAccess();
