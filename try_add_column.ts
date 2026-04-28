import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function tryAddColumn() {
  console.log("Trying to add 'comment' column to 'visitors' table...");
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql: "ALTER TABLE visitors ADD COLUMN IF NOT EXISTS comment TEXT;" 
  });
  
  if (error) {
    console.error("Error adding column via RPC:", error.message);
  } else {
    console.log("Column added successfully (or already exists).", data);
  }
}

tryAddColumn();
