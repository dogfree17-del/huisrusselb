import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkVisitorsTable() {
  const { data, error } = await supabase.from('visitors').select('*').limit(1);
  if (error) {
    console.error("Error fetching visitors:", error);
  } else if (data && data.length > 0) {
    console.log("Columns in visitors:", Object.keys(data[0]));
  } else {
    console.log("No data in visitors table to check columns.");
    // Try to get schema via another way if possible, but usually select * limit 1 is enough if there's data.
    // If no data, I might need to add the column.
  }
}

checkVisitorsTable();
