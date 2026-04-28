import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getTableColumns() {
  console.log('--- Getting Columns for notices table ---');
  
  const { data, error } = await supabase
    .from('notices')
    .select('*')
    .limit(1);
    
  if (data && data.length > 0) {
    console.log('Columns in notices:', Object.keys(data[0]));
  } else {
    console.log('No data found in notices table or error:', error?.message);
  }

  console.log('--- Getting Columns for users table ---');
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .limit(1);
    
  if (userData && userData.length > 0) {
    console.log('Columns in users:', Object.keys(userData[0]));
  } else {
    console.log('No data found in users table or error:', userError?.message);
  }
}

getTableColumns();
