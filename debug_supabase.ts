import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugSchema() {
  console.log('--- Debugging Supabase Schema ---');
  
  // 1. List all tables
  const { data: tables, error: tablesError } = await supabase
    .from('users') // Just to check if we can reach any table
    .select('*')
    .limit(1);
    
  if (tablesError) {
    console.error('Error reaching "users" table:', tablesError.message);
  } else {
    console.log('Successfully reached "users" table.');
  }

  // Try to get all table names using a raw query if possible, 
  // but since we don't have an RPC for that usually, let's try common ones.
  const commonTables = [
    'users', 'notices', 'market', 'bookings', 'maintenance', 
    'visitor_logs', 'visitors', 'visitor', 'feedback', 
    'anonymous_reports', 'notifications', 'posts', 'photos', 'files', 'stats'
  ];

  for (const table of commonTables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(`Table "${table}": NOT FOUND or ERROR (${error.message})`);
    } else {
      console.log(`Table "${table}": FOUND (Data: ${JSON.stringify(data)})`);
    }
  }
}

debugSchema();
