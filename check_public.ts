
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPublic() {
  const collections = ['notices', 'causes', 'market', 'posts'];
  for (const col of collections) {
    try {
      const { data, error } = await supabase
        .from(col)
        .select('*')
        .limit(1);
      
      if (error) throw error;
      console.log(`${col}: ${data && data.length > 0 ? 'Has data' : 'Empty'} (Success)`);
    } catch (e) {
      console.log(`${col}: Permission Denied or Error`);
    }
  }
  process.exit(0);
}

checkPublic();
