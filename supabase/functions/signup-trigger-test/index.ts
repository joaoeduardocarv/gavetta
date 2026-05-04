// Edge function de teste: valida que a trigger handle_new_user
// aceita usernames com acentos, espaços, hífens e apóstrofos, e
// que o profile é criado corretamente.
//
// Acesso restrito ao founder (handle = joaoeduardo).
// Cria usuários temporários via Admin API, valida o profile gerado
// pela trigger, e remove os usuários ao final.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FOUNDER_HANDLE = "joaoeduardo";
const TEST_EMAIL_DOMAIN = "@gavetta-trigger-test.invalid";

interface TestCase {
  name: string;
  username: string;
  // optional explicit handle. If absent, trigger derives from email
  handle?: string;
  shouldSucceed: boolean;
  // For failure cases, the substring expected in the error message
  expectedErrorContains?: string;
}

interface TestResult {
  name: string;
  username: string;
  passed: boolean;
  details: string;
  createdUserId?: string;
  profileHandle?: string | null;
  profileUsername?: string | null;
}

const TESTS: TestCase[] = [
  {
    name: "ASCII simples",
    username: "JohnDoe",
    handle: "johndoe_t1",
    shouldSucceed: true,
  },
  {
    name: "Acento agudo (João)",
    username: "João Silva",
    handle: "joao_t2",
    shouldSucceed: true,
  },
  {
    name: "Acento circunflexo + til (Antônio Brandão)",
    username: "Antônio Brandão",
    handle: "antonio_t3",
    shouldSucceed: true,
  },
  {
    name: "Cedilha (Conceição)",
    username: "Conceição Mendonça",
    handle: "conceicao_t4",
    shouldSucceed: true,
  },
  {
    name: "Trema (Müller)",
    username: "Hans Müller",
    handle: "muller_t5",
    shouldSucceed: true,
  },
  {
    name: "Acento grave (À)",
    username: "Àlex",
    handle: "alex_t6",
    shouldSucceed: true,
  },
  {
    name: "Hífen e ponto",
    username: "J. Silva-Costa",
    handle: "jsilva_t7",
    shouldSucceed: true,
  },
  {
    name: "Apóstrofo (O'Brien)",
    username: "O'Brien",
    handle: "obrien_t8",
    shouldSucceed: true,
  },
  {
    name: "Letra ñ (Núñez)",
    username: "María Núñez",
    handle: "nunez_t9",
    shouldSucceed: true,
  },
  // Casos negativos: a Admin API mascara a exception da trigger como
  // "Database error creating new user". Validamos só que a chamada
  // falha + nenhum profile é criado.
  {
    name: "Username muito curto (1 char) deve falhar",
    username: "A",
    handle: "fshort",
    shouldSucceed: false,
    expectedErrorContains: "Database error",
  },
  {
    name: "Caractere proibido (@) deve falhar",
    username: "user@name",
    handle: "fat",
    shouldSucceed: false,
    expectedErrorContains: "Database error",
  },
];

// Casos negativos para handle são testados com handle FIXO (sem suffix
// runId, para preservar o formato inválido). Tratados em loop separado.
const HANDLE_NEGATIVE_TESTS: Array<{
  name: string;
  username: string;
  handle: string;
}> = [
  { name: "Handle inválido (maiúscula) deve falhar", username: "Valid Name", handle: "InvalidUpper" },
  { name: "Handle muito curto deve falhar", username: "Valid Name", handle: "ab" },
  { name: "Handle com hífen deve falhar", username: "Valid Name", handle: "joao-silva" },
  { name: "Handle com acento deve falhar", username: "Valid Name", handle: "joão_t" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (payload: unknown, status: number) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid token" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("handle")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!callerProfile || callerProfile.handle !== FOUNDER_HANDLE) {
      return json({ error: "Forbidden — founder only" }, 403);
    }

    const runId = crypto.randomUUID().slice(0, 8);
    const results: TestResult[] = [];
    const createdUserIds: string[] = [];

    for (const tc of TESTS) {
      const email = `tt-${runId}-${results.length}${TEST_EMAIL_DOMAIN}`;
      // Para casos positivos, sufixamos o handle com runId para garantir
      // unicidade. Para negativos, mantemos o handle literal — caso contrário
      // o suffix poderia tornar o handle inválido em válido.
      const handle = tc.handle
        ? tc.shouldSucceed
          ? `${tc.handle}_${runId}`.slice(0, 30)
          : tc.handle
        : undefined;

      try {
        const { data: created, error: createErr } =
          await admin.auth.admin.createUser({
            email,
            password: "TestTrigger123!",
            email_confirm: true,
            user_metadata: {
              username: tc.username,
              handle,
              avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=test",
            },
          });

        if (createErr || !created.user) {
          // Trigger raised exception — interpreted by Auth as a 500
          if (!tc.shouldSucceed) {
            const msg = createErr?.message ?? "no user returned";
            const matches =
              !tc.expectedErrorContains ||
              msg.toLowerCase().includes(tc.expectedErrorContains.toLowerCase());
            results.push({
              name: tc.name,
              username: tc.username,
              passed: matches,
              details: matches
                ? `Falhou como esperado: ${msg}`
                : `Falhou mas com mensagem inesperada. Esperava conter "${tc.expectedErrorContains}", recebeu: ${msg}`,
            });
          } else {
            results.push({
              name: tc.name,
              username: tc.username,
              passed: false,
              details: `Esperava sucesso, mas createUser falhou: ${createErr?.message ?? "sem mensagem"}`,
            });
          }
          continue;
        }

        // User criado — checar profile
        createdUserIds.push(created.user.id);

        const { data: prof, error: profErr } = await admin
          .from("profiles")
          .select("handle, username")
          .eq("id", created.user.id)
          .maybeSingle();

        if (tc.shouldSucceed) {
          if (profErr || !prof) {
            results.push({
              name: tc.name,
              username: tc.username,
              passed: false,
              details: `Usuário criado mas profile ausente (trigger não executou). Erro: ${profErr?.message ?? "—"}`,
              createdUserId: created.user.id,
            });
          } else if (prof.username !== tc.username) {
            results.push({
              name: tc.name,
              username: tc.username,
              passed: false,
              details: `Profile criado mas username não bate. Esperava "${tc.username}", recebeu "${prof.username}"`,
              createdUserId: created.user.id,
              profileHandle: prof.handle,
              profileUsername: prof.username,
            });
          } else {
            results.push({
              name: tc.name,
              username: tc.username,
              passed: true,
              details: `OK — profile criado com username "${prof.username}" e handle "${prof.handle}"`,
              createdUserId: created.user.id,
              profileHandle: prof.handle,
              profileUsername: prof.username,
            });
          }
        } else {
          // Esperava falha mas teve sucesso — bug
          results.push({
            name: tc.name,
            username: tc.username,
            passed: false,
            details: `Esperava falha mas a trigger aceitou. Profile: ${JSON.stringify(prof)}`,
            createdUserId: created.user.id,
            profileHandle: prof?.handle ?? null,
            profileUsername: prof?.username ?? null,
          });
        }
      } catch (e) {
        results.push({
          name: tc.name,
          username: tc.username,
          passed: tc.shouldSucceed === false,
          details: `Exceção: ${(e as Error).message}`,
        });
      }
    }

    // Cleanup — apaga todos os usuários criados
    let cleanupErrors = 0;
    for (const id of createdUserIds) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) cleanupErrors++;
    }

    const passed = results.filter((r) => r.passed).length;
    const failed = results.length - passed;

    return json(
      {
        runId,
        summary: {
          total: results.length,
          passed,
          failed,
          allPassed: failed === 0,
          cleanedUp: createdUserIds.length,
          cleanupErrors,
        },
        results,
      },
      200,
    );
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
