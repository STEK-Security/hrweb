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
  const client = new SMTPClient({
    connection: {
      hostname: config.hostname,
      port: config.port,
      tls: false, // 587: denomailer가 STARTTLS로 자동 업그레이드
      auth: { username: config.username, password: config.password },
    },
  });

  try {
    await client.send({
      from: `${config.senderName} <${config.username}>`,
      to: mail.to,
      subject: mail.subject,
      content: mail.body,
      html: mail.html,
    });
  } finally {
    await client.close();
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

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

  // SMTP 설정은 모든 모드에 공통이므로 여기서 한 번만 확인 (누락 시 명확한 500)
  let smtpConfig: SmtpConfig;
  try {
    smtpConfig = getSmtpConfig();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500, origin);
  }

  try {
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
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500, origin);
  }
});
