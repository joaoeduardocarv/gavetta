import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

// Temporary admin-only fixture provisioning; removed after the browser check.
Deno.serve(async (req) => {
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key || !service) return respond({ error: "Missing configuration" }, 500);
  const caller = createClient(url, key, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: identity, error } = await caller.auth.getUser();
  if (error || !identity.user) return respond({ error: "Unauthorized" }, 401);
  const role = await caller.rpc("has_role", { _user_id: identity.user.id, _role: "admin" });
  if (role.error || role.data !== true) return respond({ error: "Forbidden" }, 403);
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const body = await req.json();
  if (body.action === "cleanup") {
    const results = [];
    for (const id of body.ids || []) {
      const lookup = await admin.auth.admin.getUserById(id);
      const meta = lookup.data.user?.user_metadata;
      if (meta?.qa_notification_fixture !== identity.user.id) return respond({ error: "Not a fixture owned by caller" }, 403);
      const deleted = await admin.auth.admin.deleteUser(id);
      results.push({ id, deleted: !deleted.error });
    }
    return respond({ results });
  }
  if (body.action !== "create") return respond({ error: "Invalid action" }, 400);
  const created: string[] = [];
  try {
    const accounts = [];
    const run = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    for (const label of ["a", "b"]) {
      const email = `qa-notification-${run}-${label}@gavetta.com.br`;
      const password = crypto.randomUUID() + crypto.randomUUID();
      const result = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: `Verificação ${label.toUpperCase()}`, handle: `qa_${run}_${label}`, avatar_url: "/favicon-192.png", qa_notification_fixture: identity.user.id } });
      if (result.error || !result.data.user) throw new Error(result.error?.message || "Creation failed");
      created.push(result.data.user.id);
      const profile = await admin.from("profiles").update({ is_public: false, onboarded_at: new Date().toISOString(), avatar_selected_at: new Date().toISOString() }).eq("id", result.data.user.id);
      if (profile.error) throw profile.error;
      const client = createClient(url, key, { auth: { persistSession: false } });
      const login = await client.auth.signInWithPassword({ email, password });
      if (login.error || !login.data.session) throw new Error(login.error?.message || "Login failed");
      accounts.push({ id: result.data.user.id, session: login.data.session });
    }
    return respond({ accounts });
  } catch (e) {
    for (const id of created) await admin.auth.admin.deleteUser(id);
    return respond({ error: e instanceof Error ? e.message : "Fixture provisioning failed" }, 500);
  }
});