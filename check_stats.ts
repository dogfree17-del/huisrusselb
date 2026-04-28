
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkStats() {
  try {
    const { data, error } = await supabase
      .from('stats')
      .select('*')
      .eq('id', 'visits')
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    if (data) {
      console.log(`STATS_VISITS: ${JSON.stringify(data)}`);
    } else {
      console.log("STATS_VISITS: Not found");
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

checkStats();
