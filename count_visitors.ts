
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function countVisitors() {
  try {
    const { count, error } = await supabase
      .from('visitors')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    console.log(`TOTAL_VISITORS_COUNT: ${count}`);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

countVisitors();
