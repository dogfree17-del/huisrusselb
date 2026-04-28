import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listAllTables() {
  const { data, error } = await supabase.rpc('get_tables'); // If this RPC exists
  
  if (error) {
    console.log('RPC get_tables failed, trying direct query on information_schema...');
    const { data: tables, error: schemaError } = await supabase
      .from('pg_catalog.pg_tables')
      .select('tablename')
      .eq('schemaname', 'public');
      
    if (schemaError) {
      console.error('Error querying pg_tables:', schemaError.message);
      
      // Try one more way - just listing what we can find by trial and error or other means
    } else {
      console.log('Tables in public schema:', tables.map(t => t.tablename));
    }
  } else {
    console.log('Tables from RPC:', data);
  }
}

listAllTables();
