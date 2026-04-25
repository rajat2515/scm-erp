import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.rpc('get_policies'); // or we can query pg_indexes if possible
  // since we can't easily query pg_constraint via rest, let's just do a duplicate insert test
  const testData = { sr_no: 99999, month: 'Test Month', due_amount: 100, paid_amount: 50, mode: 'cash' };
  await supabase.from('fee_payments').delete().eq('sr_no', 99999);
  await supabase.from('fee_payments').insert(testData);
  const { error: err2 } = await supabase.from('fee_payments').insert(testData);
  console.log("Insert 2 error:", err2?.message || "Success");
  await supabase.from('fee_payments').delete().eq('sr_no', 99999);
}
check();
