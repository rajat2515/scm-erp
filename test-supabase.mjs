import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envPath = './.env.local';
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (e) {
  try {
    envContent = fs.readFileSync('./.env', 'utf8');
  } catch (e2) {
    console.error("Could not find .env or .env.local");
    process.exit(1);
  }
}

const envVars = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
      const key = parts[0];
      const vals = parts.slice(1);
      if (key) envVars[key.trim()] = vals.join('=').trim().replace(/['"]/g, '');
  }
});

const supaUrl = envVars['VITE_SUPABASE_URL'];
const supaKey = envVars['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(supaUrl, supaKey);

async function test() {
  const { data, error } = await supabase
    .from('students')
    .select('sr_no')
    .order('sr_no', { ascending: false })
    .limit(5);

  console.log("Data:", data, "Error:", error);
}

test();
