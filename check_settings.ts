import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data, error } = await supabase
    .from('settings')
    .select('*');
  
  if (error) {
    console.error("Error:", error);
  } else if (data && data.length > 0) {
    console.log("Settings:", data);
  } else {
    console.log("No settings found!");
  }
  process.exit(0);
}
check();
