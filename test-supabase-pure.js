import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Testing auth.signIn...');
  try {
    const authPromise = supabase.auth.signInWithPassword({ email: 'admin@scmacademy.edu', password: 'password' });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject('Timeout!'), 10000));
    const result = await Promise.race([authPromise, timeoutPromise]);
    console.log('Auth result:', result);
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
