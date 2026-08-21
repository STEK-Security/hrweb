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
//   SMTP 발송은 외부 패키지(denomailer) 없이 이 파일 안에 직접 구현한
//   최소 SMTP 클라이언트(raw TCP + STARTTLS)를 사용한다. denomailer는
//   edge-runtime 컨테이너에서 STARTTLS 업그레이드 중 워커가 크래시하여
//   try/catch로도 잡히지 않는 502/503을 유발했기 때문에 제거했다.
//   office365(smtp.office365.com:587)는 STARTTLS만 지원하므로
//   Deno.startTls 업그레이드가 핵심 경로다.
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

interface SmtpSendOptions {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
  to: string;
  subject: string;
  body: string;
  html?: string;
}

interface SmtpResult {
  ok: boolean;
  steps: string[];
  error?: string;
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

// =============================================================
// Vendored 최소 SMTP 클라이언트 (외부 import 없음)
// raw Deno TCP 연결 + STARTTLS(Deno.startTls) + AUTH LOGIN
// =============================================================

const SMTP_IO_TIMEOUT_MS = 15000;

function withIoTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return withTimeout(promise, SMTP_IO_TIMEOUT_MS, label);
}

function base64Encode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${base64Encode(subject)}?=`;
}

function wrapBase64(b64: string): string {
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 76) lines.push(b64.slice(i, i + 76));
  return lines.join("\r\n");
}

// SMTP 응답(멀티라인 포함)을 읽어 마지막 라인의 3자리 코드를 반환.
// ponytail: 컨트롤 응답은 보통 한 번의 read로 충분히 들어오므로, 코드+공백
// 패턴이 나타나면 완료로 간주한다. 응답 한 줄이 여러 read에 걸쳐 쪼개지는
// 극단적 케이스까지는 다루지 않음 — 문제가 되면 라인 버퍼링을 강화.
async function readSmtpResponse(conn: Deno.Conn): Promise<{ code: string; text: string }> {
  const decoder = new TextDecoder();
  let buf = "";
  const chunk = new Uint8Array(4096);
  while (true) {
    const n = await withIoTimeout(conn.read(chunk), "SMTP 응답 읽기");
    if (n === null) {
      throw new Error(`연결이 응답 없이 종료됨 (누적: ${buf.slice(-200)})`);
    }
    buf += decoder.decode(chunk.subarray(0, n));
    const lines = buf.split("\r\n").filter((l) => l.length > 0);
    const lastLine = lines[lines.length - 1] ?? "";
    if (/^\d{3} /.test(lastLine)) {
      return { code: lastLine.slice(0, 3), text: buf };
    }
    // "NNN-" 형태(멀티라인 중간)면 계속 읽음
  }
}

async function writeSmtpCommand(conn: Deno.Conn, command: string): Promise<void> {
  const encoder = new TextEncoder();
  await withIoTimeout(
    conn.write(encoder.encode(command + "\r\n")),
    `명령 전송(${command.split(" ")[0]})`,
  );
}

async function writeSmtpRaw(conn: Deno.Conn, text: string): Promise<void> {
  const encoder = new TextEncoder();
  await withIoTimeout(conn.write(encoder.encode(text)), "DATA 본문 전송");
}

// connect → greeting(220) → EHLO → STARTTLS(220) → Deno.startTls 업그레이드까지 수행.
// 성공 시 업그레이드된 conn과 지금까지의 steps를 반환, 실패 시 conn을 정리하고 에러를 반환.
// sendViaSmtp(실제 발송)와 diag의 tls_upgrade 점검이 이 부분을 공유한다.
async function connectAndStartTls(
  host: string,
  port: number,
): Promise<{ ok: true; conn: Deno.Conn; steps: string[] } | { ok: false; steps: string[]; error: string }> {
  const steps: string[] = [];
  let raw: Deno.TcpConn | null = null;
  try {
    raw = await withIoTimeout(Deno.connect({ hostname: host, port }), "connect");
    steps.push("connect");

    let resp = await readSmtpResponse(raw);
    if (resp.code !== "220") throw new Error(`greeting 실패: ${resp.code} ${resp.text}`);
    steps.push("greeting(220)");

    await writeSmtpCommand(raw, "EHLO localhost");
    resp = await readSmtpResponse(raw);
    if (resp.code !== "250") throw new Error(`EHLO 실패: ${resp.code} ${resp.text}`);
    steps.push("EHLO");

    await writeSmtpCommand(raw, "STARTTLS");
    resp = await readSmtpResponse(raw);
    if (resp.code !== "220") throw new Error(`STARTTLS 실패: ${resp.code} ${resp.text}`);
    steps.push("STARTTLS(220)");

    let tlsConn: Deno.TlsConn;
    try {
      tlsConn = await Deno.startTls(raw, { hostname: host });
    } catch (err) {
      throw new Error(`startTls failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    steps.push("startTls업그레이드");

    return { ok: true, conn: tlsConn, steps };
  } catch (err) {
    if (raw) {
      try {
        raw.close();
      } catch {
        // 정리 실패는 무시 (원래 에러만 보고)
      }
    }
    return { ok: false, steps, error: err instanceof Error ? err.message : String(err) };
  }
}

// diag 모드용: STARTTLS 업그레이드까지만 시도하고 발송은 하지 않는다.
async function checkTlsUpgrade(): Promise<SmtpResult> {
  const host = Deno.env.get("SMTP_HOST");
  const portRaw = Deno.env.get("SMTP_PORT");
  const port = Number(portRaw);
  if (!host || !Number.isFinite(port)) {
    return { ok: false, steps: [], error: "SMTP_HOST/SMTP_PORT 미설정 또는 잘못됨" };
  }

  const result = await connectAndStartTls(host, port);
  if (!result.ok) return result;

  try {
    result.conn.close();
  } catch {
    // 정리 실패는 무시
  }
  return { ok: true, steps: result.steps };
}

// STARTTLS 업그레이드 이후 EHLO2 → AUTH LOGIN → MAIL FROM → RCPT TO → DATA → 본문 → QUIT.
// 모든 예외를 잡아 {ok:false, steps, error}로 반환한다 (throw가 밖으로 나가면 워커가 503을 낼 수 있어 절대 금지).
async function sendViaSmtp(opts: SmtpSendOptions): Promise<SmtpResult> {
  const result = await connectAndStartTls(opts.host, opts.port);
  if (!result.ok) return result;

  const steps = result.steps;
  const conn: Deno.Conn = result.conn;

  try {
    await writeSmtpCommand(conn, "EHLO localhost");
    let resp = await readSmtpResponse(conn);
    if (resp.code !== "250") throw new Error(`EHLO2 실패: ${resp.code} ${resp.text}`);
    steps.push("EHLO2");

    await writeSmtpCommand(conn, "AUTH LOGIN");
    resp = await readSmtpResponse(conn);
    if (resp.code !== "334") throw new Error(`AUTH LOGIN 실패: ${resp.code} ${resp.text}`);

    await writeSmtpCommand(conn, base64Encode(opts.user));
    resp = await readSmtpResponse(conn);
    if (resp.code !== "334") throw new Error(`AUTH LOGIN(user) 실패: ${resp.code} ${resp.text}`);

    await writeSmtpCommand(conn, base64Encode(opts.pass));
    resp = await readSmtpResponse(conn);
    if (resp.code !== "235") throw new Error(`AUTH LOGIN(pass) 실패: ${resp.code} ${resp.text}`);
    steps.push("AUTH LOGIN(334→base64(user)→334→base64(pass)→235)");

    await writeSmtpCommand(conn, `MAIL FROM:<${opts.user}>`);
    resp = await readSmtpResponse(conn);
    if (resp.code !== "250") throw new Error(`MAIL FROM 실패: ${resp.code} ${resp.text}`);
    steps.push("MAIL FROM(250)");

    await writeSmtpCommand(conn, `RCPT TO:<${opts.to}>`);
    resp = await readSmtpResponse(conn);
    if (resp.code !== "250") throw new Error(`RCPT TO 실패: ${resp.code} ${resp.text}`);
    steps.push("RCPT TO(250)");

    await writeSmtpCommand(conn, "DATA");
    resp = await readSmtpResponse(conn);
    if (resp.code !== "354") throw new Error(`DATA 실패: ${resp.code} ${resp.text}`);
    steps.push("DATA(354)");

    const useHtml = !!opts.html;
    const contentType = useHtml ? "text/html; charset=UTF-8" : "text/plain; charset=UTF-8";
    const encodedBody = base64Encode(useHtml ? (opts.html as string) : opts.body);
    const headers = [
      `From: ${opts.fromName} <${opts.user}>`,
      `To: <${opts.to}>`,
      `Subject: ${encodeSubject(opts.subject)}`,
      "MIME-Version: 1.0",
      `Content-Type: ${contentType}`,
      "Content-Transfer-Encoding: base64",
    ].join("\r\n");
    const message = `${headers}\r\n\r\n${wrapBase64(encodedBody)}\r\n.\r\n`;

    await writeSmtpRaw(conn, message);
    resp = await readSmtpResponse(conn);
    if (resp.code !== "250") throw new Error(`메일 본문 전송 실패: ${resp.code} ${resp.text}`);
    steps.push("message(250)");

    try {
      await writeSmtpCommand(conn, "QUIT");
      await readSmtpResponse(conn);
      steps.push("QUIT");
    } catch {
      // QUIT 실패는 발송 결과에 영향 없음 (본문은 이미 수락됨)
      steps.push("QUIT(무시됨)");
    }

    return { ok: true, steps };
  } catch (err) {
    return { ok: false, steps, error: err instanceof Error ? err.message : String(err) };
  } finally {
    try {
      conn.close();
    } catch {
      // 정리 실패는 무시
    }
  }
}

// diag 모드: 실제 발송 없이 SMTP 관련 환경/네트워크/TLS 상태만 점검 (각 항목 독립 try/catch, 절대 크래시 금지)
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
    diag.tls_upgrade = await checkTlsUpgrade();
  } catch (err) {
    diag.tls_upgrade = { ok: false, steps: [], error: err instanceof Error ? err.message : String(err) };
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

async function sendOne(config: SmtpConfig, mail: MailInput): Promise<SmtpResult> {
  return await sendViaSmtp({
    host: config.hostname,
    port: config.port,
    user: config.username,
    pass: config.password,
    fromName: config.senderName,
    to: mail.to,
    subject: mail.subject,
    body: mail.body,
    html: mail.html,
  });
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

    // 진단 모드: 실제 발송 없이 env/TCP/TLS 업그레이드 상태만 점검해 반환 (503 원인 확정용)
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
      const results: Array<{ id: unknown; to: string; ok: boolean; steps: string[]; error?: string }> = [];

      for (const row of rows ?? []) {
        const result = await sendOne(smtpConfig, { to: row.to_email, subject: row.subject, body: row.body ?? "" });
        results.push({ id: row.id, to: row.to_email, ok: result.ok, steps: result.steps, error: result.error });

        if (result.ok) {
          await adminClient
            .from("mail_queue")
            .update({ status: "발송완료", sent_at: new Date().toISOString() })
            .eq("id", row.id);
          sent++;
        } else {
          // 개별 메일 실패가 배치 전체를 죽이지 않도록 다음 행 계속 처리
          await adminClient.from("mail_queue").update({ status: "실패" }).eq("id", row.id);
          failed++;
          console.error(`mail_queue ${row.id} 발송 실패:`, result.error, result.steps);
        }
      }

      return jsonResponse({ sent, failed, results }, 200, origin);
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
    const results: Array<{ to: string; ok: boolean; steps: string[]; error?: string }> = [];

    for (const mail of mails) {
      const result = await sendOne(smtpConfig, mail);
      if (result.ok) {
        sent++;
      } else {
        // 개별 메일 실패가 배치 전체를 죽이지 않도록 다음 메일 계속 처리
        failed++;
        console.error(`메일 발송 실패 (${mail.to}):`, result.error, result.steps);
      }
      results.push({ to: mail.to, ok: result.ok, steps: result.steps, error: result.error });
    }

    return jsonResponse({ sent, failed, results }, 200, origin);
  } catch (err) {
    // 최상위 캐치: 여기서 잡히지 않는 예외는 없어야 함 (503 대신 항상 JSON 500)
    const stack = err instanceof Error ? err.stack?.slice(0, 500) : undefined;
    return jsonResponse({ error: String(err), stack }, 500, origin);
  }
});
