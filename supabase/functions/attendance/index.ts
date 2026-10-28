// =============================================================
// Supabase Edge Function: attendance (Deno)
// -------------------------------------------------------------
// hr.stek.kr 근태관리 → time.stek.win /api/admin/* 중계.
// 배포: send-mail 과 같이 functions 볼륨 `/home/deno/functions/attendance/{index,routes}.ts` 에 배치.
// env: SUPABASE_URL, SUPABASE_ANON_KEY (기본 제공),
//      ATTENDANCE_ADMIN_TOKEN (필수, Worker ADMIN_TOKEN — 브라우저·레포 금지),
//      ATTENDANCE_API_URL (선택, 기본 https://time.stek.win)
// 요청: POST { method, path, query?: Record<string,string>, body?: unknown }
// 응답: Worker 의 상태코드·본문 그대로. 401 비로그인 / 403 비HR / 400 화이트리스트 밖 / 504 타임아웃.
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { allowed } from "./routes.ts";

const TIMEOUT_MS = 20000;

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": origin ?? "*",
  };
}

function jsonResponse(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

const isStringRecord = (v: unknown): v is Record<string, string> =>
  !!v && typeof v === "object" && !Array.isArray(v) &&
  Object.values(v as Record<string, unknown>).every((x) => typeof x === "string");

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  try {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed", message: "POST만 지원합니다." }, 405, origin);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const adminToken = Deno.env.get("ATTENDANCE_ADMIN_TOKEN");
    const apiUrl = (Deno.env.get("ATTENDANCE_API_URL") || "https://time.stek.win").replace(/\/+$/, "");
    if (!supabaseUrl || !anonKey || !adminToken) {
      return jsonResponse({ error: "config", message: "SUPABASE_URL / SUPABASE_ANON_KEY / ATTENDANCE_ADMIN_TOKEN 환경변수가 없습니다." }, 500, origin);
    }

    // 호출자 JWT 로 사용자 확인 + is_hr() 재검증
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = jwt ? await callerClient.auth.getUser(jwt) : { data: { user: null } };
    const user = userData?.user;
    if (!user?.email) return jsonResponse({ error: "unauthorized", message: "로그인이 필요합니다." }, 401, origin);

    const { data: isHr, error: isHrError } = await callerClient.rpc("is_hr");
    if (isHrError || !isHr) return jsonResponse({ error: "forbidden", message: "HR 권한이 필요합니다." }, 403, origin);

    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ error: "bad_request", message: "요청 본문이 올바른 JSON이 아닙니다." }, 400, origin);
    }
    const { method, path, query, body } = payload ?? {};
    if (typeof method !== "string" || typeof path !== "string" || !allowed(method, path)) {
      return jsonResponse({ error: "bad_request", message: "허용되지 않은 경로입니다." }, 400, origin);
    }
    if (query !== undefined && !isStringRecord(query)) {
      return jsonResponse({ error: "bad_request", message: "query 는 문자열 맵이어야 합니다." }, 400, origin);
    }

    const qs = query && Object.keys(query).length ? `?${new URLSearchParams(query)}` : "";
    let upstream: Response;
    try {
      upstream = await fetch(apiUrl + path + qs, {
        method,
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "X-Actor": user.email,
          "Content-Type": "application/json",
        },
        body: method === "GET" || body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "TimeoutError";
      return jsonResponse(
        { error: timedOut ? "timeout" : "upstream", message: timedOut ? "근태 서버 응답 시간 초과" : `근태 서버 연결 실패: ${String(err)}` },
        timedOut ? 504 : 502,
        origin,
      );
    }

    // Worker 상태·본문 그대로 전달
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
        ...corsHeaders(origin),
      },
    });
  } catch (err) {
    return jsonResponse({ error: "internal", message: String(err) }, 500, origin);
  }
});
