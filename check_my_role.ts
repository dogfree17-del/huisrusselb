import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserRole() {
  const email = 'dogfree17@gmail.com';
  const { data, error } = await supabase.from('users').select('*').eq('email', email).single();
  
  if (error) {
    console.error("Error fetching user:", error);
  } else {
    console.log("User data:", data);
  }
}

checkUserRole();
