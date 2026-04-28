import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  const tables = [
    'users', 'stats', 'notices', 'bookings', 'maintenance', 
    'market', 'visitors', 'visitor_log', 'visitor', 'feedback', 'anonymous_reports', 
    'settings', 'ice_breaker_answers', 'reviews', 'causes', 
    'polls', 'post', 'posts', 'photos', 'files', 'point_awards', 'notifications', 'visitor_logs'
  ];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table ${table} error:`, error.message);
    } else if (data && data.length > 0) {
      console.log(`Table ${table} sample:`, JSON.stringify(data[0], null, 2));
    } else {
      console.log(`Table ${table} is empty.`);
    }
  }
}

checkSchema();
