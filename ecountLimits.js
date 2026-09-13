// ecountLimits.js
// 이카운트 오픈 API의 "호출 제한"(매뉴얼 2-5)과 "IP 차단 방지 규칙"(매뉴얼 2-6)을
// 한 곳에서 강제하는 부품. ecount.js의 모든 호출은 반드시 이 파일을 거쳐 나간다.
//
// 근거: 이카운트 Open API 매뉴얼(sboapicb.ecount.com/ECERP/OAPIView/OAPIManual)
//       2026-09-13 열람분 인계서 2-5 / 2-6.
//
//   구분          | 대상 API                                   | 제한
//   ------------- | ------------------------------------------ | -----------
//   Zone          | Zone                                        | 10분 1회
//   로그인        | OAPILogin                                   | 10분 1회
//   목록조회      | 품목조회·재고현황·창고별재고현황·발주서조회  | 10분 1회
//   단건조회      | View… 계열                                  | 1초 1회
//   저장          | Save… 계열 (생산입고·판매·주문서 등)         | 10초 1회
//
// 그 외: 시간당 연속 오류 30건 / 1회 최대 300건 / 1일 최대 5,000건.
// 초과하면 HTTP 412 또는 302가 돌아온다.

const TEN_MINUTES = 10 * 60 * 1000;

// mode
//   reject : 제한 시간 안이면 기다리지 않고 바로 거절한다(로그인 계열 — 기다리면 요청이 10분 멈춤).
//   cache  : 제한 시간 안이면 직전 응답을 그대로 돌려준다(목록조회).
//   queue  : 제한 시간이 지날 때까지 줄을 세워 기다린다(단건조회 1초, 저장 10초).
const LIMITS = {
  zone:   { label: "Zone",     minIntervalMs: TEN_MINUTES, mode: "reject" },
  login:  { label: "로그인",   minIntervalMs: TEN_MINUTES, mode: "reject" },
  list:   { label: "목록조회", minIntervalMs: TEN_MINUTES, mode: "cache" },
  single: { label: "단건조회", minIntervalMs: 1000,        mode: "queue" },
  save:   { label: "저장",     minIntervalMs: 10 * 1000,   mode: "queue" },
};

// 로그인 실패가 이만큼 쌓이면 그 회사에 대한 호출을 스스로 멈춘다.
// 매뉴얼 2-6: 같은 IP에서 Zone·로그인 실패가 10회 이상이면 ERP 로그인까지 IP 차단.
// 10회까지 가기 전에 3회에서 멈춘다.
const MAX_LOGIN_FAILURES = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── 호출 간격 관리 ────────────────────────────────────────
// 간격은 "칸(bucket)" 단위로 지킨다.
//  - 조회(목록·단건)는 API 경로마다 따로 센다. 제한이 API별이기 때문에, 품목조회 때문에
//    재고조회가 10분씩 막히면 안 된다.
//  - 저장은 모든 저장 API가 한 칸을 같이 쓴다(가장 위험한 쪽이라 더 엄격하게).
//  - Zone·로그인은 경로가 하나뿐이라 카테고리가 곧 칸이다.
const lastCallAt = {};   // 칸 -> 마지막 호출 시각(ms)
const chains = {};       // 칸 -> 직렬 대기줄(Promise)
const waiting = {};      // 칸 -> 현재 줄 서 있는 건수
const bucketCategory = {}; // 칸 -> 카테고리

function bucketKey(category, path) {
  if (category === "list" || category === "single") {
    const clean = String(path || "").split("?")[0];
    return `${category}|${clean}`;
  }
  return category;
}

// ── 목록조회 캐시 ─────────────────────────────────────────
const listCache = new Map(); // 키 -> { data, cachedAt }

// ── 회사별 로그인 실패 누계 ───────────────────────────────
const loginState = {};   // 회사키 -> { failures, lastMessage, lockedAt, lastSuccessAt }

// ── 이카운트가 알려주는 사용량(QUANTITY_INFO) 마지막 값 ───
let lastQuantityInfo = null;

/** API 경로를 보고 어떤 제한에 걸리는지 고른다. 모르는 경로는 가장 보수적인 단건조회로 본다. */
function classifyPath(path) {
  const p = String(path || "");
  const last = p.split("?")[0].split("/").filter(Boolean).pop() || "";
  if (/^Zone$/i.test(last)) return "zone";
  if (/^OAPILogin$/i.test(last)) return "login";
  if (/^Save/i.test(last)) return "save";
  if (/^Get.*List/i.test(last) || /^GetList/i.test(last)) return "list";
  if (/^View/i.test(last)) return "single";
  return "single";
}

function cacheKey(path, body) {
  let bodyPart = "";
  try {
    const obj = body && typeof body === "object" ? body : {};
    // 세션·인증 관련 값은 키에서 뺀다(매번 달라지므로 캐시가 안 먹힘).
    const filtered = {};
    for (const k of Object.keys(obj).sort()) {
      if (["SESSION_ID", "API_CERT_KEY", "USER_ID", "ZONE", "COM_CODE", "LAN_TYPE"].includes(k)) continue;
      filtered[k] = obj[k];
    }
    bodyPart = JSON.stringify(filtered);
  } catch {
    bodyPart = "";
  }
  return `${path}|${bodyPart}`;
}

function remainingMs(bucket) {
  const cfg = LIMITS[bucketCategory[bucket] || bucket];
  if (!cfg) return 0;
  const last = lastCallAt[bucket] || 0;
  return Math.max(0, last + cfg.minIntervalMs - Date.now());
}

/** 같은 칸의 호출을 한 줄로 세워, 정해진 간격을 지킨 뒤 실행한다. */
function schedule(category, bucket, fn) {
  bucketCategory[bucket] = category;
  waiting[bucket] = (waiting[bucket] || 0) + 1;
  const prev = chains[bucket] || Promise.resolve();
  const run = prev.then(async () => {
    const wait = remainingMs(bucket);
    if (wait > 0) await sleep(wait);
    lastCallAt[bucket] = Date.now();
    try {
      return await fn();
    } finally {
      waiting[bucket] -= 1;
    }
  });
  // 앞사람이 오류로 끝나도 뒷사람 줄이 끊기지 않게 한다.
  chains[bucket] = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/**
 * 제한 규칙을 지켜서 실제 호출(doCall)을 수행한다.
 * 반환: { data, meta } — meta.category / meta.cached / meta.cachedAt / meta.waitedMs
 */
async function withLimit(path, body, doCall) {
  const category = classifyPath(path);
  const cfg = LIMITS[category];
  const bucket = bucketKey(category, path);
  bucketCategory[bucket] = category;
  const startedAt = Date.now();

  if (cfg.mode === "reject") {
    const wait = remainingMs(bucket);
    if (wait > 0) {
      throw new Error(
        `${cfg.label} API는 10분에 1회만 호출할 수 있습니다(이카운트 제한). ` +
          `${Math.ceil(wait / 1000)}초 뒤에 다시 시도하세요. 무리하게 반복하면 IP가 차단됩니다.`
      );
    }
    lastCallAt[bucket] = Date.now();
    const data = await doCall();
    noteQuantityInfo(data);
    return { data, meta: { category, cached: false, waitedMs: 0 } };
  }

  if (cfg.mode === "cache") {
    const key = cacheKey(path, body);
    const hit = listCache.get(key);
    if (hit && Date.now() - hit.cachedAt < cfg.minIntervalMs) {
      return {
        data: hit.data,
        meta: { category, cached: true, cachedAt: hit.cachedAt, waitedMs: 0 },
      };
    }
    try {
      const data = await schedule(category, bucket, doCall);
      noteQuantityInfo(data);
      listCache.set(key, { data, cachedAt: Date.now() });
      return { data, meta: { category, cached: false, waitedMs: Date.now() - startedAt } };
    } catch (err) {
      // 호출이 막혔는데(412 등) 지난 캐시가 있으면, 오래된 값이라도 돌려준다.
      if (hit) {
        return {
          data: hit.data,
          meta: {
            category,
            cached: true,
            stale: true,
            cachedAt: hit.cachedAt,
            error: err.message,
            waitedMs: Date.now() - startedAt,
          },
        };
      }
      throw err;
    }
  }

  // queue (단건조회 1초 / 저장 10초)
  const data = await schedule(category, bucket, doCall);
  noteQuantityInfo(data);
  return { data, meta: { category, cached: false, waitedMs: Date.now() - startedAt } };
}

function noteQuantityInfo(data) {
  const q = data && (data.QUANTITY_INFO || data.Data?.QUANTITY_INFO);
  if (q) lastQuantityInfo = { at: new Date().toISOString(), info: q };
}

// ── 로그인 전 검증 · 실패 누계 · 자동 중단 (매뉴얼 2-6) ────

/** 로그인 API를 부르기 "전에" 접속 정보가 형태상 멀쩡한지 본다. 틀린 값으로 두드리면 IP가 차단된다. */
function validateCredentials(companyKey, company) {
  const problems = [];
  const check = (name, value) => {
    if (!value || !String(value).trim()) problems.push(`${name} 값이 비어 있음`);
    else if (/\s/.test(String(value))) problems.push(`${name} 값에 공백/줄바꿈이 섞여 있음`);
  };
  check(`${companyKey.toUpperCase()}_COM_CODE`, company.comCode);
  check(`${companyKey.toUpperCase()}_USER_ID`, company.userId);
  check(`${companyKey.toUpperCase()}_API_CERT_KEY`, company.apiCertKey);
  if (company.apiCertKey && String(company.apiCertKey).trim().length < 20) {
    problems.push(`${companyKey.toUpperCase()}_API_CERT_KEY 길이가 너무 짧음(인증키가 잘린 것으로 보임)`);
  }
  if (problems.length) {
    throw new Error(
      `${company.label} 접속 정보가 올바르지 않아 로그인을 시도하지 않았습니다: ${problems.join(", ")}. ` +
        `Render 사이트 Environment 메뉴에서 값을 고친 뒤 다시 시도하세요.`
    );
  }
}

function loginRecord(companyKey) {
  if (!loginState[companyKey]) {
    loginState[companyKey] = { failures: 0, lastMessage: null, lockedAt: null, lastSuccessAt: null };
  }
  return loginState[companyKey];
}

/** 실패가 쌓여 자동 중단된 상태면 아예 호출하지 않고 막는다. */
function assertLoginAllowed(companyKey, label) {
  const rec = loginRecord(companyKey);
  if (rec.lockedAt) {
    throw new Error(
      `${label} 이카운트 로그인이 ${MAX_LOGIN_FAILURES}회 연속 실패해 자동으로 중단된 상태입니다` +
        `(${new Date(rec.lockedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} 기준). ` +
        `마지막 오류: ${rec.lastMessage || "?"}. ` +
        `회사코드·사용자ID·인증키·등록 IP를 확인한 뒤 ecount_api_status 도구의 reset_login_lock으로 해제하세요. ` +
        `그대로 반복하면 이카운트가 이 서버 IP를 차단해 ERP 로그인까지 막힙니다.`
    );
  }
}

function recordLoginSuccess(companyKey) {
  const rec = loginRecord(companyKey);
  rec.failures = 0;
  rec.lockedAt = null;
  rec.lastMessage = null;
  rec.lastSuccessAt = Date.now();
}

/** 로그인 실패를 기록한다. 한도에 닿으면 잠그고 운영자에게 알린다. */
function recordLoginFailure(companyKey, label, message) {
  const rec = loginRecord(companyKey);
  rec.failures += 1;
  rec.lastMessage = message;
  if (rec.failures >= MAX_LOGIN_FAILURES && !rec.lockedAt) {
    rec.lockedAt = Date.now();
    notifyOperator(
      `[이카운트 API 중단] ${label} 로그인 ${rec.failures}회 연속 실패로 자동 중단했습니다. ` +
        `마지막 오류: ${message}. IP 차단을 막기 위해 더 이상 시도하지 않습니다.`
    );
  }
  return rec;
}

function resetLoginLock(companyKey) {
  const rec = loginRecord(companyKey);
  const had = rec.lockedAt;
  rec.failures = 0;
  rec.lockedAt = null;
  rec.lastMessage = null;
  return { 회사: companyKey, 해제됨: Boolean(had) };
}

/** 운영자 알림: 서버 로그에 남기고, ALERT_WEBHOOK_URL이 있으면 그쪽으로도 보낸다(실패해도 무시). */
function notifyOperator(text) {
  console.error(text);
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "ecount-mcp", level: "alert", text, at: new Date().toISOString() }),
    }).catch(() => {});
  } catch {
    /* 알림 실패가 본 작업을 막지 않게 한다 */
  }
}

/** 지금 제한 상태가 어떤지 사람이 읽을 수 있게 돌려준다. */
function getStatus() {
  const fmt = (ms) => (ms ? new Date(ms).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : null);
  const categories = {};
  for (const [key, cfg] of Object.entries(LIMITS)) {
    const buckets = Object.keys(bucketCategory).filter((b) => bucketCategory[b] === key);
    categories[cfg.label] = {
      제한: cfg.minIntervalMs >= TEN_MINUTES ? "10분 1회" : `${cfg.minIntervalMs / 1000}초 1회`,
      처리방식: { reject: "즉시 거절", cache: "캐시 사용", queue: "줄 서서 대기" }[cfg.mode],
      셈단위: key === "save" ? "모든 저장 API 공통" : key === "list" || key === "single" ? "API 경로별" : "단일 경로",
      현황: buckets.map((b) => ({
        칸: b,
        마지막호출: fmt(lastCallAt[b]),
        남은대기초: Math.ceil(remainingMs(b) / 1000),
        대기중건수: waiting[b] || 0,
      })),
    };
  }
  const companies = {};
  for (const [key, rec] of Object.entries(loginState)) {
    companies[key] = {
      연속실패: rec.failures,
      자동중단: Boolean(rec.lockedAt),
      중단시각: fmt(rec.lockedAt),
      마지막성공: fmt(rec.lastSuccessAt),
      마지막오류: rec.lastMessage,
    };
  }
  return {
    호출제한: categories,
    로그인상태: companies,
    목록캐시: {
      보관건수: listCache.size,
      항목: [...listCache.entries()].map(([k, v]) => ({
        키: k,
        받은시각: fmt(v.cachedAt),
        남은유효초: Math.max(0, Math.ceil((v.cachedAt + TEN_MINUTES - Date.now()) / 1000)),
      })),
    },
    이카운트사용량: lastQuantityInfo,
    자동중단기준: `로그인 연속 실패 ${MAX_LOGIN_FAILURES}회`,
  };
}

/** 시험용: 내부 상태를 초기화한다(운영 중에는 쓰지 않는다). */
function _resetAll() {
  for (const k of Object.keys(lastCallAt)) delete lastCallAt[k];
  for (const k of Object.keys(chains)) delete chains[k];
  for (const k of Object.keys(waiting)) delete waiting[k];
  for (const k of Object.keys(bucketCategory)) delete bucketCategory[k];
  for (const k of Object.keys(loginState)) delete loginState[k];
  listCache.clear();
  lastQuantityInfo = null;
}

module.exports = {
  LIMITS,
  MAX_LOGIN_FAILURES,
  classifyPath,
  withLimit,
  validateCredentials,
  assertLoginAllowed,
  recordLoginSuccess,
  recordLoginFailure,
  resetLoginLock,
  notifyOperator,
  getStatus,
  _resetAll,
};
