import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  verifyFirebaseIdToken,
  normalizePhoneForDb,
} from "../_shared/verifyFirebaseToken.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type AuthRole = "parent" | "student" | "admin";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const body = (await req.json()) as { idToken?: string; role?: string; user_name?: string };
    const idToken = body?.idToken;
    const role = body?.role as AuthRole | undefined;
    const user_name = typeof body?.user_name === "string" ? body.user_name.trim() : "";

    if (!idToken || typeof idToken !== "string") {
      return new Response(
        JSON.stringify({ error: "idToken이 필요합니다" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    if (!role || !["parent", "student", "admin"].includes(role)) {
      return new Response(
        JSON.stringify({ error: "유효한 role이 필요합니다 (parent, student, admin)" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    if (!user_name) {
      return new Response(
        JSON.stringify({ error: "실명(이름)이 필요합니다" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const payload = await verifyFirebaseIdToken(idToken);
    if (!payload?.localId) {
      return new Response(
        JSON.stringify({ error: "유효하지 않거나 만료된 토큰입니다" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const phone = payload.phoneNumber
      ? normalizePhoneForDb(payload.phoneNumber)
      : null;
    if (!phone) {
      return new Response(
        JSON.stringify({ error: "휴대폰 번호 정보를 찾을 수 없습니다" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: "이미 가입된 휴대폰 번호입니다" }),
        { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const email = `${payload.localId.replace(/-/g, "")}@firebase.phone`;
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      phone,
      phone_confirm: true,
      user_metadata: {
        phone,
        firebase_uid: payload.localId,
        role,
        user_name,
      },
    });

    if (createError) {
      console.error("createUser error:", createError);
      return new Response(
        JSON.stringify({ error: createError.message ?? "회원가입 처리에 실패했습니다" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: "사용자 생성에 실패했습니다" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { error: roleError } = await supabase.from("user_roles").upsert(
      { user_id: newUser.user.id, role },
      { onConflict: "user_id" }
    );
    if (roleError) {
      console.error("user_roles upsert:", roleError);
    }

    // 트리거가 profiles를 생성했으면 user_name을 명시적으로 업데이트 (트리거 타이밍 문제 방지)
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        { id: newUser.user.id, phone, user_name },
        { onConflict: "id" }
      );
    if (profileError) {
      console.error("profiles upsert:", profileError);
    }

    // 클라이언트에서 Supabase 세션을 만들 수 있도록 매직 링크 토큰 생성
    let token_hash: string | undefined;
    const userEmail = newUser.user.email ?? "";
    if (userEmail) {
      const { data: linkData } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: userEmail,
      });
      const actionLink = linkData?.properties?.action_link;
      if (actionLink) {
        try {
          const url = new URL(actionLink);
          token_hash = url.searchParams.get("token") ?? undefined;
        } catch {
          // ignore
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, ...(token_hash && { token_hash }) }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (e) {
    console.error("firebase-signup error:", e);
    return new Response(
      JSON.stringify({ error: "서버 오류가 발생했습니다" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});