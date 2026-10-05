/**
 * Bootstrap script: creates a STAFF or SENIOR_VET account.
 *
 * Public registration can only create CLIENT accounts, so privileged accounts are
 * created here with the Supabase service-role key (server-side only, never in the browser).
 * The full in-app user management UI for this is built in Phase 12.
 *
 * Usage (from the project root, with .env.local filled in):
 *   npm run create-privileged-user -- --email vet@clinic.test --password "Str0ngPass1" --first-name "Alex" --last-name "Sample" --role SENIOR_VET
 *   npm run create-privileged-user -- --email staff@clinic.test --password "Str0ngPass1" --first-name "Taylor" --last-name "Example" --role STAFF
 */
import { createClient } from "@supabase/supabase-js";

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

const email = arg("email")?.trim().toLowerCase();
const password = arg("password");
const firstName = arg("first-name")?.trim();
const lastName = arg("last-name")?.trim();
const role = arg("role")?.trim().toUpperCase();
const contact = arg("contact")?.trim() ?? null;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

if (!url || !serviceKey) {
  fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");
}
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("Provide a valid --email.");
if (!password || password.length < 8) fail("Provide a --password of at least 8 characters.");
if (!firstName || !lastName) fail('Provide --first-name and --last-name, e.g. --first-name "Alex" --last-name "Sample".');
if (role !== "STAFF" && role !== "SENIOR_VET") fail("--role must be STAFF or SENIOR_VET.");

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: {
    first_name: firstName,
    last_name: lastName,
    ...(contact ? { contact_number: contact } : {}),
  },
});
if (error || !data.user) fail(`Could not create auth user: ${error?.message ?? "unknown error"}`);

// The database trigger created a CLIENT profile; promote it (service role bypasses the column grants).
const { error: updateError } = await admin
  .from("profiles")
  .update({ role, status: "ACTIVE", first_name: firstName, last_name: lastName })
  .eq("id", data.user.id);

if (updateError) {
  // Do not leave a half-created account behind.
  await admin.auth.admin.deleteUser(data.user.id);
  fail(`Could not set role (auth user rolled back): ${updateError.message}`);
}

console.log(`Created ${role} account for ${email} (id: ${data.user.id}).`);
