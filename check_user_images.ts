import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  const { data: users, error } = await supabase.from('users').select('uid, profile_image_url').not('profile_image_url', 'is', null);
  if (error) {
    console.error("Error:", error);
    return;
  }

  const firebaseUsers = users.filter(u => u.profile_image_url && u.profile_image_url.includes('firebasestorage'));
  console.log(`Found ${firebaseUsers.length} users with Firebase profile images.`);
  
  if (firebaseUsers.length > 0) {
     console.log("Example:", firebaseUsers[0]);
  }
}

checkUsers();
