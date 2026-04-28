import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('--- Checking users table ---');
  const { data: users, error: userError } = await supabase.from('users').select('*').limit(1);
  if (userError) console.error('Users error:', userError.message);
  else if (users && users.length > 0) console.log('Users columns:', Object.keys(users[0]));
  else console.log('Users table empty or error');

  console.log('--- Checking point_awards table ---');
  const { data: awards, error: awardError } = await supabase.from('point_awards').select('*').limit(1);
  if (awardError) {
    console.error('Awards error:', awardError.message);
    if (awardError.message.includes('does not exist')) {
      console.log('CRITICAL: point_awards table DOES NOT EXIST');
    }
  } else if (awards && awards.length > 0) {
    console.log('Awards columns:', Object.keys(awards[0]));
  } else {
    console.log('Awards table exists but is empty');
  }
}

checkSchema();
