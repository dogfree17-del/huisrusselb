import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listTables() {
  const { data, error } = await supabase.rpc('get_tables'); // This might not work if RPC is not defined
  if (error) {
    // Try another way: query information_schema
    const { data: tables, error: tablesError } = await supabase.from('pg_tables').select('tablename').eq('schemaname', 'public');
    // Wait, pg_tables is not accessible via PostgREST usually.
    
    // Let's try to just guess or use a known RPC if it exists.
    // Alternatively, I can use the provided schema from the user if I can see it.
    console.log("Error listing tables:", error.message);
  } else {
    console.log("Tables:", data);
  }
}

async function checkInformationSchema() {
    const { data, error } = await supabase.rpc('get_schema_info');
    if (error) {
        console.log("RPC get_schema_info failed");
    } else {
        console.log("Schema Info:", data);
    }
}

listTables();
