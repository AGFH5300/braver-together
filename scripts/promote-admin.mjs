import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/promote-admin.mjs <admin-email>");
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let page = 1;
let user = null;
while (!user) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw error;
  user = data.users.find((candidate) => candidate.email?.toLowerCase() === email) ?? null;
  if (user || data.users.length < 100) break;
  page += 1;
}

if (!user) {
  console.error(`No Supabase Auth user exists for ${email}. Create/sign in to that account first, then run this command again.`);
  process.exit(1);
}

const { error: roleError } = await admin
  .from("user_roles")
  .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });

if (roleError) throw roleError;

console.log(`Administrator access granted to ${email}.`);
console.log("Sign out and sign back in so the application refreshes the account role.");
