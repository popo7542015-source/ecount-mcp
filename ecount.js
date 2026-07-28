// ecount.js
// 이카운트 오픈 API 래퍼: 로그인(세션발급) + 재고조회 + 거래처조회
//
// 참고: 이 파일은 이카운트 공식 문서에 공개된 흐름(Zone 조회 -> 로그인 -> 세션ID 발급 ->
// Zone+세션ID로 각 API 호출)을 근거로 작성했습니다. 실제 이카운트 서버로 테스트해보지
// 못한 상태이므로, 최초 배포 후 에러가 나면 로그를 보고 수정해야 합니다.

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

async function getZone(comCode) {
  // 회사코드로 Zone을 조회하는 API. 정확한 엔드포인트는 이카운트 로그인 후
  // "Self-Customizing > API 인증키발급" 메뉴의 API 문서에서 재확인 필요.
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
      `Zone 조회 실패. 응답: ${JSON.stringify(data)} — .env에 ZONE 값을 직접 넣는 것으로 우회 가능`
    );
  }
  return zone;
}

async function login(companyKey) {
  const company = COMPANIES[companyKey];
  if (!company) throw new Error(`알 수 없는 회사: ${companyKey}`);
  if (!company.comCode || !company.userId || !company.apiCertKey) {
    throw new Error(
      `${company.label} 접속 정보가 .env에 설정되지 않았습니다 (COM_CODE/USER_ID/API_CERT_KEY 확인)`
    );
  }

  const cached = sessionCache[companyKey];
  if (cached && cached.expiresAt > Date.now()) {
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
    throw new Error(`로그인 실패. 응답: ${JSON.stringify(data)}`);
  }

  const session = {
    sessionId,
    zone,
    comCode: company.comCode,
    userId: company.userId,
    apiCertKey: company.apiCertKey,
    expiresAt: Date.now() + 25 * 60 * 1000, // 세션 유효시간 넉넉히 25분으로 가정 (문서상 정확한 만료시간 미확인)
  };
  sessionCache[companyKey] = session;
  return session;
}

async function callApi(companyKey, path, extraBody = {}) {
  const session = await login(companyKey);
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
  const data = await res.json();
  return data;
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

  const rows = data?.Data?.Result || data?.Data?.Datas || [];
  if (!Array.isArray(rows)) return { raw: data };

  const keyword = (itemKeyword || "").trim();
  const matched = keyword
    ? rows.filter(
        (r) =>
          (r.PROD_DES && r.PROD_DES.includes(keyword)) ||
          (r.PROD_CD && r.PROD_CD.includes(keyword))
      )
    : rows;

  return matched.map((r) => ({
    품목코드: r.PROD_CD,
    품목명: r.PROD_DES,
    창고: r.WH_DES || r.WH_CD,
    재고수량: r.BAL_QTY ?? r.QTY,
  }));
}

// 거래처명으로 거래처 정보(전화번호 등) 조회
// 주의: 정확한 엔드포인트 경로는 미확인 상태. 이카운트 API 문서에서
// "거래처" 또는 "기초정보 - 거래처등록" 관련 API를 확인해 아래 path를 교체해야 할 수 있음.
async function getClient(companyKey, clientKeyword) {
  const data = await callApi(companyKey, "/OAPI/V2/Account/GetBasicAccount", {});

  const rows = data?.Data?.Result || data?.Data?.Datas || [];
  if (!Array.isArray(rows)) return { raw: data };

  const keyword = (clientKeyword || "").trim();
  const matched = keyword
    ? rows.filter((r) => r.CUST_DES && r.CUST_DES.includes(keyword))
    : rows;

  return matched.map((r) => ({
    거래처코드: r.CUST,
    거래처명: r.CUST_DES,
    전화번호: r.TEL_NO || r.HP_NO,
    담당자: r.CHARGE_PERSON,
    주소: r.ADDR,
  }));
}

module.exports = { getInventory, getClient, COMPANIES };
