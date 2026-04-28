import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  console.log('--- Testing insert into point_awards ---');
  const { error } = await supabase.from('point_awards').insert({
    userId: 'test-uid',
    actionId: 'test-action',
    points: 0.01,
    awardedAt: new Date().toISOString()
  });
  
  if (error) {
    console.error('Insert error:', error.message);
    console.error('Full error:', JSON.stringify(error, null, 2));
  } else {
    console.log('Insert successful!');
    // Clean up
    await supabase.from('point_awards').delete().eq('userId', 'test-uid');
  }
}

testInsert();
