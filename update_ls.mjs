import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ouuxrysibttrfcneudrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91dXhyeXNpYnR0cmZjbmV1ZHJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDUxODAsImV4cCI6MjA4ODgyMTE4MH0.ZXPnZ9zhsPuBMoA8qKlCuaR5Tmrh'
);

// First, check how many LS students exist
const { data: lsStudents, error: fetchErr } = await supabase
  .from('students')
  .select('sr_no, name, status')
  .eq('class', 'LS');

if (fetchErr) {
  console.error('Fetch error:', fetchErr.message);
  process.exit(1);
}

console.log(`Found ${lsStudents.length} students with class = 'LS'`);
lsStudents.forEach(s => console.log(`  SR ${s.sr_no}: ${s.name} (currently: ${s.status})`));

// Now update all LS students to inactive
const { error: updateErr, count } = await supabase
  .from('students')
  .update({ status: 'inactive' })
  .eq('class', 'LS')
  .select();

if (updateErr) {
  console.error('Update error:', updateErr.message);
  process.exit(1);
}

console.log(`\n✅ Successfully set ${lsStudents.length} LS students to INACTIVE.`);
