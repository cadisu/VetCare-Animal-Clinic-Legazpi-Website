/**
 * Bootstrap script: creates a STAFF or SENIOR_VET account.
 *
 * Public registration can only create CLIENT accounts, so privileged accounts are
 * created here with the Supabase service-role key (server-side only, never in the browser).
 *
 * Optional: --veterinarian-id <uuid> links public.veterinarians.profile_id after creation.
 *
 * Usage (from the project root, with .env.local filled in):
 *   npm run create-privileged-user -- --email dr.carmela@vetcare.clinic --password "..." --first-name Carmela --last-name "De Guzman-Yanga" --role SENIOR_VET --veterinarian-id a1000000-0000-4000-8000-000000000001
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
const veterinarianId = arg("veterinarian-id")?.trim() ?? null;

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
if (!firstName || !lastName) fail('Provide --first-name and --last-name.');
if (role !== "STAFF" && role !== "SENIOR_VET") fail("--role must be STAFF or SENIOR_VET.");

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let userId;

const { data: existingProfile } = await admin
  .from("profiles")
  .select("id, role")
  .eq("email", email)
  .maybeSingle();

if (existingProfile) {
  userId = existingProfile.id;
  if (existingProfile.role !== role) {
    const { error: roleError } = await admin
      .from("profiles")
      .update({ role, status: "ACTIVE", first_name: firstName, last_name: lastName })
      .eq("id", userId);
    if (roleError) fail(`Could not update role: ${roleError.message}`);
    console.log(`Updated existing account ${email} to ${role}.`);
  } else {
    console.log(`Account already exists for ${email} (${role}). Skipped creation.`);
  }
} else {
  if (!password || password.length < 8) fail("Provide a --password of at least 8 characters for new accounts.");
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
  userId = data.user.id;

  const { error: updateError } = await admin
    .from("profiles")
    .update({ role, status: "ACTIVE", first_name: firstName, last_name: lastName })
    .eq("id", userId);

  if (updateError) {
    await admin.auth.admin.deleteUser(userId);
    fail(`Could not set role (auth user rolled back): ${updateError.message}`);
  }
  console.log(`Created ${role} account for ${email} (id: ${userId}).`);
}

if (veterinarianId) {
  const { error: linkError } = await admin
    .from("veterinarians")
    .update({ profile_id: userId })
    .eq("id", veterinarianId);
  if (linkError) fail(`Could not link veterinarian ${veterinarianId}: ${linkError.message}`);
  console.log(`Linked veterinarian ${veterinarianId} to profile ${userId}.`);
}
