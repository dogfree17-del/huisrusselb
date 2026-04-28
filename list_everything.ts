import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listEverything() {
  console.log('--- Listing All Tables and Views in public schema ---');
  
  // Try querying the information_schema via a raw SQL if we had an RPC, 
  // but we don't. Let's try to use the 'supabase' object to explore.
  
  // One trick is to try and fetch from a non-existent table and see the error message, 
  // sometimes it lists suggestions. But not always.
  
  // Let's try to use the 'get_tables' RPC again, maybe it was just a typo or something.
  const { data, error } = await supabase.rpc('get_tables');
  if (data) {
    console.log('Tables from RPC:', data);
    return;
  }

  // If RPC fails, let's try to guess some more names based on the stats table.
  const statsData = await supabase.from('stats').select('*').eq('id', 'counters').single();
  if (statsData.data) {
    console.log('Stats counters:', statsData.data);
    const keys = Object.keys(statsData.data);
    console.log('Potential table names from stats keys:', keys);
    
    for (const key of keys) {
      if (['id', 'visits', 'count', 'whatsappClicks'].includes(key)) continue;
      const { data: tableData, error: tableError } = await supabase.from(key).select('*').limit(1);
      if (tableError) {
        console.log(`Table "${key}": NOT FOUND (${tableError.message})`);
      } else {
        console.log(`Table "${key}": FOUND`);
      }
    }
  }
}

listEverything();
