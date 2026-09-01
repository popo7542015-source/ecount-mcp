require("dotenv").config();

const DOMAIN = process.env.ECOUNT_USE_PRODUCTION === "true" ? "oapi" : "sboapi";

async function debugLogin() {
  console.log("🔍 세광 로그인 디버깅\n");
  console.log("환경설정:");
  console.log(`  DOMAIN: ${DOMAIN}`);
  console.log(`  SEGWANG_COM_CODE: ${process.env.SEGWANG_COM_CODE}`);
  console.log(`  SEGWANG_USER_ID: ${process.env.SEGWANG_USER_ID}`);
  console.log(`  SEGWANG_API_CERT_KEY: ${process.env.SEGWANG_API_CERT_KEY}`);
  console.log(`  SEGWANG_ZONE: ${process.env.SEGWANG_ZONE || "(비어있음)"}\n`);

  try {
    // 1. Zone 조회 시도
    console.log("1️⃣ Zone 조회 시도...");
    const zoneUrl = `https://${DOMAIN}.ecount.com/OAPI/V2/Zone`;
    console.log(`URL: ${zoneUrl}`);

    const zoneRes = await fetch(zoneUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ COM_CODE: process.env.SEGWANG_COM_CODE }),
    });

    console.log(`상태코드: ${zoneRes.status}`);
    const zoneText = await zoneRes.text();
    console.log(`응답 (처음 200글자): ${zoneText.substring(0, 200)}`);

    if (zoneRes.ok) {
      const zoneData = JSON.parse(zoneText);
      console.log(`✅ Zone 조회 성공:`, zoneData);
    } else {
      console.log(`❌ Zone 조회 실패`);
      return;
    }

    // 2. 로그인 시도
    console.log("\n2️⃣ 로그인 시도...");
    const zone = process.env.SEGWANG_ZONE || "test";
    const loginUrl = `https://${DOMAIN}${zone}.ecount.com/OAPI/V2/OAPILogin`;
    console.log(`URL: ${loginUrl}`);

    const loginRes = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        COM_CODE: process.env.SEGWANG_COM_CODE,
        USER_ID: process.env.SEGWANG_USER_ID,
        API_CERT_KEY: process.env.SEGWANG_API_CERT_KEY,
        LAN_TYPE: "ko-KR",
        ZONE: zone,
      }),
    });

    console.log(`상태코드: ${loginRes.status}`);
    const loginText = await loginRes.text();
    console.log(`응답 (처음 300글자): ${loginText.substring(0, 300)}`);

    if (loginRes.ok) {
      const loginData = JSON.parse(loginText);
      console.log(`✅ 로그인 성공:`, loginData);
    } else {
      console.log(`❌ 로그인 실패`);
    }
  } catch (err) {
    console.error("❌ 오류:", err.message);
  }
}

debugLogin();
