import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function paystack(path: string, method: "GET" | "POST", body?: Record<string, unknown>) {
  const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!secret) throw new Error("PAYSTACK_SECRET_KEY is not configured in Supabase.");
  const response = await fetch(`https://api.paystack.co${path}`, {
    method,
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.status !== true) {
    throw new Error(payload.message || `Paystack request failed (${response.status}).`);
  }
  return payload.data;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Please sign in again." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Payout service is not configured." }, 503);
  }

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Your session is invalid. Please sign in again." }, 401);
  const user = authData.user;
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return json({ error: "Invalid request body." }, 400); }
  const action = input.action;

  try {
    if (action === "list_banks") {
      const data = await paystack("/bank?currency=ZAR&perPage=100", "GET");
      const banks = Array.isArray(data)
        ? data.filter((bank: any) => bank.active && !bank.is_deleted).map((bank: any) => ({
            name: bank.name, code: bank.code, supported_types: bank.supported_types ?? [],
          }))
        : [];
      return json({ banks });
    }

    const replacing = action === "replace_subaccount";
    if (action !== "create_subaccount" && !replacing) return json({ error: "Unsupported action." }, 400);

    const bankCode = String(input.bank_code ?? "").trim();
    const accountNumber = String(input.account_number ?? "").replace(/\s+/g, "");
    const accountType = String(input.account_type ?? "personal");
    if (!/^\d{4,20}$/.test(accountNumber)) return json({ error: "Enter a valid bank account number." }, 400);
    if (!/^\d{4,10}$/.test(bankCode)) return json({ error: "Please select a valid bank." }, 400);
    if (!["personal", "business"].includes(accountType)) return json({ error: "Invalid account type." }, 400);

    const { data: profile, error: profileError } = await admin
      .from("driver_profiles")
      .select("user_id,application_status,legal_name,phone,payout_provider,payout_recipient_id,payout_status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return json({ error: "Complete your driver application first." }, 404);
    if (profile.application_status !== "approved") {
      return json({ error: "Your driver application must be approved before payout setup." }, 403);
    }
    const oldRecipientId = profile.payout_recipient_id ?? null;
    const oldStatus = profile.payout_status;
    if (replacing && (profile.payout_provider !== "paystack" || !oldRecipientId)) {
      return json({ error: "There is no existing Paystack bank account to replace." }, 409);
    }
    if (!replacing && oldRecipientId && profile.payout_provider === "paystack") {
      return json({ already_connected: true, payout_status: oldStatus, message: "A Paystack payout account is already linked. Use Change bank account to replace it." });
    }
    if (oldStatus === "pending" && profile.payout_provider === "paystack") {
      return json({ error: "Payout setup is already awaiting review. Complete that review before requesting another change." }, 409);
    }

    let lockQuery = admin.from("driver_profiles")
      .update({ payout_provider: "paystack", payout_status: "pending", updated_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("payout_status", oldStatus);
    lockQuery = replacing ? lockQuery.eq("payout_recipient_id", oldRecipientId) : lockQuery.is("payout_recipient_id", null);
    const { data: locked, error: lockError } = await lockQuery.select("user_id").maybeSingle();
    if (lockError) throw lockError;
    if (!locked) return json({ error: "Payout setup changed or is already processing. Refresh the page." }, 409);

    let paystackCreated = false;
    try {
      const email = user.email ?? "";
      const created = await paystack("/subaccount", "POST", {
        business_name: (profile.legal_name || "Lotty Go Driver").slice(0, 100),
        bank_code: bankCode,
        account_number: accountNumber,
        percentage_charge: 25,
        description: "Lotty Go driver payout account",
        primary_contact_name: profile.legal_name || undefined,
        primary_contact_email: email || undefined,
        primary_contact_phone: profile.phone || undefined,
        metadata: JSON.stringify({ lotty_go_driver_id: user.id, account_type: accountType }),
      });
      const subaccountCode = String(created.subaccount_code ?? "");
      if (!/^ACCT_/.test(subaccountCode)) throw new Error("Paystack did not return a valid subaccount code.");
      paystackCreated = true;

      const { error: saveError } = await admin.from("driver_profiles").update({
        payout_provider: "paystack",
        payout_recipient_id: subaccountCode,
        payout_status: "pending",
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);
      if (saveError) {
        // Keep the profile locked in pending: Paystack may already have created the account.
        throw new Error("Paystack created the payout account, but Lotty Go could not save its reference. Please contact support before retrying.");
      }
      return json({
        success: true,
        payout_recipient_id: subaccountCode,
        payout_status: "pending",
        account_name: created.account_name ?? null,
        bank_name: created.settlement_bank ?? null,
        message: "Payout account created. Lotty Go must verify the bank details before card payouts are enabled.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create payout account.";
      if (!paystackCreated) {
        if (replacing && oldRecipientId) {
          await admin.from("driver_profiles").update({
            payout_provider: "paystack",
            payout_status: oldStatus,
            updated_at: new Date().toISOString(),
          }).eq("user_id", user.id).eq("payout_recipient_id", oldRecipientId).eq("payout_status", "pending");
        } else {
          await admin.from("driver_profiles").update({
            payout_provider: null,
            payout_status: "not_connected",
            updated_at: new Date().toISOString(),
          }).eq("user_id", user.id).is("payout_recipient_id", null).eq("payout_status", "pending");
        }
      }
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payout request failed.";
    return json({ error: message }, 400);
  }
});
