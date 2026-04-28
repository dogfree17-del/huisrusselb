import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function promoteUser() {
  const email = 'dogfree17@gmail.com';
  const { error } = await supabase
    .from('users')
    .update({ role: 'super_admin' })
    .eq('email', email);
  
  if (error) {
    console.error("Error promoting user:", error);
  } else {
    console.log("User promoted to super_admin successfully!");
  }
}

promoteUser();
