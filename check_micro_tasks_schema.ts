import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTableSchema() {
  const { data, error } = await supabase.from('micro_tasks').select('*').limit(1);
  if (data && data.length > 0) {
    console.log("micro_tasks columns:", Object.keys(data[0]));
  } else {
    console.log("No data found or error:", error);
  }
  process.exit(0);
}
checkTableSchema();
