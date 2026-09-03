// ecount.js
// 이카운트 오픈 API 래퍼: 로그인(세션발급) + 재고조회 + 거래처조회
//
// 참고: 이 파일은 이카운트 공식 문서에 공개된 흐름(Zone 조회 -> 로그인 -> 세션ID 발급 ->
// Zone+세션ID로 각 API 호출)을 근거로 작성했습니다.

const DOMAIN = process.env.ECOUNT_USE_PRODUCTION === "true" ? "oapi" : "sboapi";
// Test Key(sboapi) vs API Key(oapi, 운영). 처음엔 Test Key로 시작 권장.

// 회사(오딘/세광)별 접속 정보. .env 에서 값을 채워 넣습니다.
const COMPANIES = {
  odin: {
    label: "오딘",
    comCode: process.env.ODIN_COM_CODE,
    userId: process.env.ODIN_USER_ID,
    apiCertKey: process.env.ODIN_API_CERT_KEY,
    zone: process.env.ODIN_ZONE, // 이미 알고 있으면 넣기 (예: "CB"). 모르면 비워두면 자동조회 시도.
  },
  segwang: {
    label: "세광",
    comCode: process.env.SEGWANG_COM_CODE,
    userId: process.env.SEGWANG_USER_ID,
    apiCertKey: process.env.SEGWANG_API_CERT_KEY,
    zone: process.env.SEGWANG_ZONE,
  },
};

// 세션 캐시 (회사별로 세션ID를 재사용, 매 호출마다 새로 로그인하지 않도록)
const sessionCache = {}; // { odin: { sessionId, zone, expiresAt } }

function summarize(data) {
  const text = JSON.stringify(data);
  return text.length > 600 ? text.slice(0, 600) + "…(생략)" : text;
}

// 이카운트 응답이 오류인지 판정. 오류면 메시지 문자열을 반환, 정상이면 null.
function apiErrorMessage(data) {
  if (!data) return "응답이 비어 있음";
  if (data.Error && (data.Error.Message || data.Error.MessageCode)) {
    return `${data.Error.Message || ""} (코드: ${data.Error.MessageCode || "?"})`;
  }
  const status = data.Status ?? data.status;
  if (status && String(status) !== "200") {
    return `Status ${status}: ${summarize(data)}`;
  }
  return null;
}

async function getZone(comCode) {
  const url = `https://${DOMAIN}.ecount.com/OAPI/V2/Zone`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ COM_CODE: comCode }),
  });
  const data = await res.json();
  const zone = data?.Data?.ZONE || data?.Data?.Zone || data?.ZONE;
  if (!zone) {
    throw new Error(
      `Zone 조회 실패. 응답: ${summarize(data)} — Render 환경변수에 ZONE 값을 직접 넣는 것으로 우회 가능`
    );
  }
  return zone;
}

async function login(companyKey, forceNew = false) {
  const company = COMPANIES[companyKey];
  if (!company) throw new Error(`알 수 없는 회사: ${companyKey}`);
  if (!company.comCode || !company.userId || !company.apiCertKey) {
    throw new Error(
      `${company.label} 접속 정보가 서버 환경변수에 설정되지 않았습니다. ` +
        `Render 사이트의 Environment 메뉴에서 ` +
        `${companyKey.toUpperCase()}_COM_CODE / ${companyKey.toUpperCase()}_USER_ID / ` +
        `${companyKey.toUpperCase()}_API_CERT_KEY 세 항목을 확인하세요.`
    );
  }

  const cached = sessionCache[companyKey];
  if (!forceNew && cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  const zone = company.zone || (await getZone(company.comCode));

  const url = `https://${DOMAIN}${zone}.ecount.com/OAPI/V2/OAPILogin`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      COM_CODE: company.comCode,
      USER_ID: company.userId,
      API_CERT_KEY: company.apiCertKey,
      LAN_TYPE: "ko-KR",
      ZONE: zone,
    }),
  });
  const data = await res.json();
  const sessionId = data?.Data?.Datas?.SESSION_ID || data?.Data?.SESSION_ID;
  if (!sessionId) {
    throw new Error(`${company.label} 로그인 실패. 응답: ${summarize(data)}`);
  }

  const session = {
    sessionId,
    zone,
    comCode: company.comCode,
    userId: company.userId,
    apiCertKey: company.apiCertKey,
    expiresAt: Date.now() + 25 * 60 * 1000, // 세션 유효시간 넉넉히 25분으로 가정
  };
  sessionCache[companyKey] = session;
  return session;
}

// 이카운트 API 1회 호출. 세션 만료로 보이는 오류면 재로그인 후 한 번 더 시도.
async function callApi(companyKey, path, extraBody = {}) {
  const attempt = async (forceNewLogin) => {
    const session = await login(companyKey, forceNewLogin);
    const url = `https://${DOMAIN}${session.zone}.ecount.com${path}?SESSION_ID=${session.sessionId}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        SESSION_ID: session.sessionId,
        COM_CODE: session.comCode,
        USER_ID: session.userId,
        ZONE: session.zone,
        API_CERT_KEY: session.apiCertKey,
        LAN_TYPE: "ko-KR",
        ...extraBody,
      }),
    });
    if (!res.ok && res.status === 404) {
      throw new Error(`API 주소를 찾을 수 없음(404): ${path}`);
    }
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(`응답이 JSON이 아님 (HTTP ${res.status}): ${path}`);
    }
    return data;
  };

  let data = await attempt(false);
  const errMsg = apiErrorMessage(data);
  if (errMsg && /session|세션|login|로그인/i.test(errMsg)) {
    // 세션 만료로 추정 → 새로 로그인해서 한 번만 재시도
    data = await attempt(true);
  }
  return data;
}

// 응답에서 목록(배열)을 꺼냄. 배열을 못 찾으면 null.
function extractRows(data) {
  const candidates = [
    data?.Data?.Result,
    data?.Data?.Datas,
    data?.Data?.Data,
    data?.Datas,
    data?.Result,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return null;
}

// 품목명(또는 품목코드)으로 재고 조회
async function getInventory(companyKey, itemKeyword) {
  const today = new Date();
  const baseDate = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(
    today.getDate()
  ).padStart(2, "0")}`;

  const data = await callApi(
    companyKey,
    "/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatusByLocation",
    { BASE_DATE: baseDate }
  );

  const errMsg = apiErrorMessage(data);
  if (errMsg) {
    throw new Error(`${COMPANIES[companyKey].label} 재고 조회 오류: ${errMsg}`);
  }

  const rows = extractRows(data);
  if (!rows) {
    throw new Error(
      `${COMPANIES[companyKey].label} 재고 조회: 목록을 찾을 수 없음. 원본 응답: ${summarize(data)}`
    );
  }

  const keyword = (itemKeyword || "").trim();
  const matched = keyword
    ? rows.filter(
        (r) =>
          (r.PROD_DES && r.PROD_DES.includes(keyword)) ||
          (r.PROD_CD && r.PROD_CD.includes(keyword))
      )
    : rows;

  if (matched.length === 0) {
    return {
      결과: "해당 품목 없음",
      설명: `전체 ${rows.length}개 품목 중 '${keyword}' 포함 품목이 없습니다. 검색어를 짧게 줄여서 다시 시도해보세요.`,
    };
  }

  return matched.map((r) => ({
    품목코드: r.PROD_CD,
    품목명: r.PROD_DES,
    창고: r.WH_DES || r.WH_CD,
    재고수량: r.BAL_QTY ?? r.QTY,
  }));
}

// 거래처 조회: 정확한 엔드포인트가 문서마다 달라서, 후보 주소를 순서대로 시도한다.
// 한 번 성공한 주소는 기억해서 다음부터 바로 사용.
const CLIENT_ENDPOINT_CANDIDATES = [
  "/OAPI/V2/AccountBasic/GetBasicCustsList",
  "/OAPI/V2/AccountBasic/GetBasicCustList",
  "/OAPI/V2/AccountBasic/GetListBasicCust",
  "/OAPI/V2/AccountBasic/GetCustomers",
  "/OAPI/V2/AccountBasic/ViewCust",
  "/OAPI/V2/CustBasic/GetBasicCustList",
  "/OAPI/V2/Cust/GetCustList",
  "/OAPI/V2/Cust/GetListCust",
  "/OAPI/V2/Customer/GetCustomerList",
  "/OAPI/V2/Account/GetCustomers",
  "/OAPI/V2/Account/GetListCustomer",
  "/OAPI/V2/BasicCust/GetBasicCustList",
];
let workingClientEndpoint = null;

async function getClient(companyKey, clientKeyword) {
  const tried = [];
  const paths = workingClientEndpoint
    ? [workingClientEndpoint]
    : CLIENT_ENDPOINT_CANDIDATES;

  for (const path of paths) {
    try {
      const data = await callApi(companyKey, path, {});
      const errMsg = apiErrorMessage(data);
      if (errMsg) {
        tried.push(`${path} → ${errMsg}`);
        continue;
      }
      const rows = extractRows(data);
      if (!rows) {
        tried.push(`${path} → 목록 없음: ${summarize(data)}`);
        continue;
      }
      workingClientEndpoint = path;

      const keyword = (clientKeyword || "").trim();
      // 필드명이 문서마다 달라서, 모든 문자열 필드에서 검색어를 찾는다.
      const matched = keyword
        ? rows.filter((r) =>
            Object.values(r).some(
              (v) => typeof v === "string" && v.includes(keyword)
            )
          )
        : rows;

      if (matched.length === 0) {
        return {
          결과: "해당 거래처 없음",
          설명: `전체 ${rows.length}개 거래처 중 '${keyword}' 포함 항목이 없습니다.`,
          성공한주소: path,
        };
      }

      return matched.map((r) => ({
        거래처코드: r.CUST || r.CUST_CD || r.BUSINESS_NO,
        거래처명: r.CUST_DES || r.CUST_NAME || r.EMP_CUST_DES,
        전화번호: r.TEL_NO || r.TEL || r.HP_NO,
        담당자: r.CHARGE_PERSON || r.BOSS_NAME,
        주소: r.ADDR || r.POST_ADDR,
        원본: r, // 필드명 검증 전이라 원본도 함께 반환 (검증 후 제거 예정)
      }));
    } catch (err) {
      tried.push(`${path} → ${err.message}`);
    }
  }

  throw new Error(
    `거래처 조회 실패. 시도한 주소들:\n${tried.join("\n")}`
  );
}

// 디버그용: 임의의 이카운트 API 경로를 직접 호출해 원본 응답을 반환
async function rawCall(companyKey, path, bodyJson) {
  let extraBody = {};
  if (bodyJson && bodyJson.trim()) {
    try {
      extraBody = JSON.parse(bodyJson);
    } catch {
      throw new Error(`body가 올바른 JSON이 아닙니다: ${bodyJson}`);
    }
  }
  return callApi(companyKey, path, extraBody);
}

module.exports = { getInventory, getClient, rawCall, COMPANIES };
