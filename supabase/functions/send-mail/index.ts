// =============================================================
// Supabase Edge Function: send-mail (Deno)
// -------------------------------------------------------------
// 배포 메모:
//   이 파일을 self-host edge-runtime(v1.74)의 functions 볼륨
//   `/home/deno/functions/send-mail/index.ts` 에 그대로 배치한다.
//   (`--main-service .../main` 라우터가 `/functions/v1/send-mail`
//   요청을 이 파일로 디스패치한다. 다른 함수/main 라우터는 건드리지 않음.)
//
//   functions 서비스 컨테이너 env에 아래 항목 추가 필요:
//     SUPABASE_URL, SUPABASE_ANON_KEY   (JWT 검증/is_hr 확인용, 보통 기본 제공)
//     SUPABASE_SERVICE_ROLE_KEY         (mode:'queue'에서 mail_queue 갱신용)
//     SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SENDER_NAME
//
//   FUNCTIONS_VERIFY_JWT=true 이므로 인증되지 않은 호출은 여기 도달하지
//   않지만, 추가로 요청자가 인사담당자/관리자인지 rpc('is_hr')로 재검증한다.
//
//   주의(우려사항): denomailer(https://deno.land/x/denomailer@1.6.0/mod.ts)를
//   import하므로 edge-runtime 컨테이너가 deno.land 로 아웃바운드 접속이
//   가능해야 한다. 사내망/방화벽으로 막혀 있어 최초 boot에서 import가
//   실패하면, 이 부분을 vendored(직접 TCP+STARTTLS 핸드셰이크) SMTP
//   구현으로 교체해야 한다.
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

interface MailInput {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

interface SmtpConfig {
  hostname: string;
  port: number;
  username: string;
  password: string;
  senderName: string;
}

const CORS_HEADERS_BASE: Record<string, string> = {
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    ...CORS_HEADERS_BASE,
    "Access-Control-Allow-Origin": origin ?? "*",
  };
}

function jsonResponse(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

// 지정 시간(ms) 내에 promise가 끝나지 않으면 타임아웃 에러로 대체 (SMTP가 워커를 물고 죽는 것 방지)
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 타임아웃 (${ms}ms 초과)`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

// diag 모드: 실제 발송 없이 SMTP 관련 환경/네트워크 상태만 점검 (각 항목 독립 try/catch, 절대 크래시 금지)
async function runDiagnostics(): Promise<Record<string, unknown>> {
  const diag: Record<string, unknown> = {};

  try {
    diag.env = {
      host: Deno.env.get("SMTP_HOST"),
      port: Deno.env.get("SMTP_PORT"),
      user: Deno.env.get("SMTP_USER"),
      hasPass: !!Deno.env.get("SMTP_PASS"),
      sender: Deno.env.get("SMTP_SENDER_NAME"),
    };
  } catch (err) {
    diag.env = { error: err instanceof Error ? err.message : String(err) };
  }

  try {
    const host = Deno.env.get("SMTP_HOST");
    const port = Number(Deno.env.get("SMTP_PORT"));
    if (!host || !Number.isFinite(port)) {
      diag.tcp = "SMTP_HOST/SMTP_PORT 미설정 또는 잘못됨";
    } else {
      const conn = await withTimeout(Deno.connect({ hostname: host, port }), 8000, "TCP 연결");
      conn.close();
      diag.tcp = "ok";
    }
  } catch (err) {
    diag.tcp = err instanceof Error ? err.message : String(err);
  }

  try {
    // SMTPClient는 파일 최상단에서 정적 import됨 — import 자체가 성공했다면 여기 도달
    diag.denomailer_import = typeof SMTPClient === "function" ? "ok" : "SMTPClient 미정의";
  } catch (err) {
    diag.denomailer_import = err instanceof Error ? err.message : String(err);
  }

  return diag;
}

// env 누락 시 명확한 메시지로 throw (호출부에서 500 처리)
function getSmtpConfig(): SmtpConfig {
  const hostname = Deno.env.get("SMTP_HOST");
  const portRaw = Deno.env.get("SMTP_PORT");
  const username = Deno.env.get("SMTP_USER");
  const password = Deno.env.get("SMTP_PASS");
  const senderName = Deno.env.get("SMTP_SENDER_NAME") ?? username ?? "";

  if (!hostname || !portRaw || !username || !password) {
    throw new Error(
      "SMTP 환경변수가 설정되지 않았습니다 (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS 필요).",
    );
  }
  const port = Number(portRaw);
  if (!Number.isFinite(port)) {
    throw new Error(`SMTP_PORT 값이 올바르지 않습니다: ${portRaw}`);
  }
  return { hostname, port, username, password, senderName };
}

async function sendOne(config: SmtpConfig, mail: MailInput): Promise<void> {
  let client: SMTPClient;
  try {
    client = new SMTPClient({
      connection: {
        hostname: config.hostname,
        port: config.port,
        tls: false, // 587: denomailer가 STARTTLS로 자동 업그레이드
        auth: { username: config.username, password: config.password },
      },
    });
  } catch (err) {
    throw new Error(`SMTPClient 생성 실패: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    await withTimeout(
      client.send({
        from: `${config.senderName} <${config.username}>`,
        to: mail.to,
        subject: mail.subject,
        content: mail.body,
        html: mail.html,
      }),
      20000,
      "SMTP 발송",
    );
  } catch (err) {
    throw new Error(`SMTP 발송 실패: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    try {
      await withTimeout(client.close(), 5000, "SMTP 종료");
    } catch (err) {
      // close 실패는 발송 결과에 영향 주지 않음 (로그만 남김)
      console.error("SMTP close 실패:", err);
    }
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  // 최상위 전면 캡처: 어떤 예외/타임아웃도 밖으로 나가지 않고 반드시 JSON 500으로 반환 (503 방지)
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (req.method !== "POST") {
      return jsonResponse({ error: "POST만 지원합니다." }, 405, origin);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
      return jsonResponse(
        { error: "SUPABASE_URL / SUPABASE_ANON_KEY 환경변수가 없습니다." },
        500,
        origin,
      );
    }

    // 호출자 JWT로 클라이언트를 구성해 is_hr() 재검증 (HR/관리자만 허용)
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: isHr, error: isHrError } = await callerClient.rpc("is_hr");
    if (isHrError) {
      return jsonResponse({ error: `권한 확인 실패: ${isHrError.message}` }, 403, origin);
    }
    if (!isHr) {
      return jsonResponse({ error: "HR 권한이 필요합니다." }, 403, origin);
    }

    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ error: "요청 본문이 올바른 JSON이 아닙니다." }, 400, origin);
    }

    // 진단 모드: 실제 발송 없이 env/TCP/import 상태만 점검해 반환 (503 원인 확정용)
    if (payload.diag === true) {
      const diag = await runDiagnostics();
      return jsonResponse({ diag }, 200, origin);
    }

    // SMTP 설정은 모든 모드에 공통이므로 여기서 한 번만 확인 (누락 시 명확한 500)
    let smtpConfig: SmtpConfig;
    try {
      smtpConfig = getSmtpConfig();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return jsonResponse({ error: message }, 500, origin);
    }

    // 모드 1: 큐 발송 — mail_queue 의 '대기' 상태 행을 읽어 발송
    if (payload.mode === "queue") {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!serviceKey) {
        return jsonResponse(
          { error: "SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다." },
          500,
          origin,
        );
      }
      const adminClient = createClient(supabaseUrl, serviceKey);

      const { data: rows, error: queryError } = await adminClient
        .from("mail_queue")
        .select("id, to_email, to_name, subject, body")
        .eq("status", "대기")
        .limit(100);

      if (queryError) {
        return jsonResponse({ error: `큐 조회 실패: ${queryError.message}` }, 500, origin);
      }

      let sent = 0;
      let failed = 0;

      for (const row of rows ?? []) {
        try {
          await sendOne(smtpConfig, { to: row.to_email, subject: row.subject, body: row.body ?? "" });
          await adminClient
            .from("mail_queue")
            .update({ status: "발송완료", sent_at: new Date().toISOString() })
            .eq("id", row.id);
          sent++;
        } catch (err) {
          // 개별 메일 실패가 배치 전체를 죽이지 않도록 캐치 후 다음 행 계속 처리
          await adminClient.from("mail_queue").update({ status: "실패" }).eq("id", row.id);
          failed++;
          console.error(`mail_queue ${row.id} 발송 실패:`, err);
        }
      }

      return jsonResponse({ sent, failed }, 200, origin);
    }

    // 모드 2: 즉시 발송 — { mails: [...] } 또는 { to, subject, body, html? }
    const mails: MailInput[] = Array.isArray(payload.mails)
      ? (payload.mails as MailInput[])
      : payload.to
        ? [
            {
              to: payload.to as string,
              subject: payload.subject as string,
              body: payload.body as string,
              html: payload.html as string | undefined,
            },
          ]
        : [];

    if (mails.length === 0) {
      return jsonResponse(
        { error: "mails 배열 또는 {to, subject, body} 가 필요합니다." },
        400,
        origin,
      );
    }

    let sent = 0;
    let failed = 0;
    const results: Array<{ to: string; ok: boolean; error?: string }> = [];

    for (const mail of mails) {
      try {
        await sendOne(smtpConfig, mail);
        sent++;
        results.push({ to: mail.to, ok: true });
      } catch (err) {
        // 개별 메일 실패가 배치 전체를 죽이지 않도록 캐치 후 다음 메일 계속 처리
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        results.push({ to: mail.to, ok: false, error: message });
        console.error(`메일 발송 실패 (${mail.to}):`, err);
      }
    }

    return jsonResponse({ sent, failed, results }, 200, origin);
  } catch (err) {
    // 최상위 캐치: 여기서 잡히지 않는 예외는 없어야 함 (503 대신 항상 JSON 500)
    const stack = err instanceof Error ? err.stack?.slice(0, 500) : undefined;
    return jsonResponse({ error: String(err), stack }, 500, origin);
  }
});
