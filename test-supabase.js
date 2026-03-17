import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Testing connection to Supabase...');
  try {
    const authPromise = supabase.auth.signInWithPassword({ email: 'admin@scmacademy.edu', password: 'password' });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject('Timeout!'), 5000));
    
    const result = await Promise.race([authPromise, timeoutPromise]);
    console.log('Auth result:', result);
    
    const dbPromise = supabase.from('users').select('*').limit(1);
    const dbResult = await Promise.race([dbPromise, timeoutPromise]);
    console.log('DB result:', dbResult);
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
