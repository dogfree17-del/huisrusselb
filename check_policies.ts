import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPolicies() {
  const { data, error } = await supabase.from('pg_policies').select('*').eq('tablename', 'settings');
  console.log("Policies:", data, error);
  process.exit(0);
}
checkPolicies();
