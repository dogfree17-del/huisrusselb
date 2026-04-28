import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testUpdate() {
  const { error } = await supabase.from('settings').update({ date: new Date().toISOString() }).eq('id', 'appConfig');
  if (error) {
    console.error("Service role update failed:", error);
  } else {
    console.log("Service role update succeeded.");
  }
  process.exit(0);
}
testUpdate();
