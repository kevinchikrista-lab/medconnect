// Setup Supabase Auth Users
// Run: node setup-auth.mjs
// Prerequisite: disable "Confirm email" di Supabase dashboard > Authentication > Providers > Email

const SUPA_URL = 'https://fnnviaibqnduczrrgcfa.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZubnZpYWlicW5kdWN6cnJnY2ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NDAzMzIsImV4cCI6MjA5ODIxNjMzMn0.mBGLVHpMp2Cqji8h94jjgT-Xigr93z0gCPDRGZ0_ug0';

const users = [
  { email: 'superadmin@prima.id',   password: 'admin12345',  profileId: '00000000-0000-0000-0000-000000000001' },
  { email: 'dr.kevin@prima.id',     password: 'dokter123',   profileId: '00000000-0000-0000-0000-000000000002' },
  { email: 'dr.sarah@prima.id',     password: 'dokter123',   profileId: '00000000-0000-0000-0000-000000000003' },
  { email: 'budi@email.com',        password: 'pasien123',   profileId: '00000000-0000-0000-0000-000000000004' },
  { email: 'sari@email.com',        password: 'pasien123',   profileId: '00000000-0000-0000-0000-000000000005' },
  { email: 'rina@email.com',        password: 'pasien123',   profileId: '00000000-0000-0000-0000-000000000006' },
  { email: 'ahmad@email.com',       password: 'pasien123',   profileId: '00000000-0000-0000-0000-000000000007' },
  { email: 'maya@email.com',        password: 'pasien123',   profileId: '00000000-0000-0000-0000-000000000008' },
  { email: 'apotek@sehatfarma.com',  password: 'apotek123',   profileId: '00000000-0000-0000-0000-000000000009' },
  { email: 'apotek@medikafarma.com', password: 'apotek123',   profileId: '00000000-0000-0000-0000-000000000010' },
];

async function createUser(u) {
  // 1. Signup via Auth API
  const signupRes = await fetch(`${SUPA_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: u.email, password: u.password })
  });
  const signupData = await signupRes.json();

  if (signupData.error) {
    // Maybe user already exists, try login instead
    const loginRes = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: u.password })
    });
    const loginData = await loginRes.json();
    if (loginData.user) {
      // Link to profile
      await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${u.profileId}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_id: loginData.user.id })
      });
      return { email: u.email, status: 'EXISTS - linked', authId: loginData.user.id };
    }
    return { email: u.email, status: 'FAILED', error: signupData.error?.message || signupData.msg };
  }

  const authId = signupData.user?.id || signupData.id;
  if (!authId) return { email: u.email, status: 'FAILED', error: 'No user ID returned' };

  // 2. Link auth user to profile
  await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${u.profileId}`, {
    method: 'PATCH',
    headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ auth_id: authId })
  });

  return { email: u.email, status: 'CREATED', authId };
}

async function main() {
  console.log('Creating Supabase Auth users...\n');

  for (const u of users) {
    const result = await createUser(u);
    const icon = result.status.includes('FAIL') ? 'X' : 'OK';
    console.log(`  ${icon}  ${result.email} - ${result.status}`);
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  // Verify: test login for each role
  console.log('\n--- Testing logins ---\n');
  const testAccounts = [
    { email: 'superadmin@prima.id', password: 'admin12345', role: 'SuperAdmin' },
    { email: 'dr.kevin@prima.id', password: 'dokter123', role: 'Dokter' },
    { email: 'budi@email.com', password: 'pasien123', role: 'Pasien' },
    { email: 'apotek@sehatfarma.com', password: 'apotek123', role: 'Apotek' },
  ];

  for (const t of testAccounts) {
    const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: t.email, password: t.password })
    });
    const data = await res.json();
    console.log(`  ${data.access_token ? 'OK' : 'FAIL'}  ${t.role} (${t.email})`);
  }

  console.log('\nDone!');
}

main().catch(e => console.error('Error:', e));
