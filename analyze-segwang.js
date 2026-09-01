require("dotenv").config();
const { getInventory, getClient } = require("./ecount");

async function analyzeSegwangAccount() {
  console.log("🏢 세광(Segwang) 계정 데이터 분석 시작\n");

  try {
    // 1. 거래처 목록 조회
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("1️⃣ 거래처 목록 조회");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
      const clients = await getClient("segwang", ""); // 모든 거래처
      console.log(`총 거래처 수: ${clients.length || 0}`);
      if (clients && clients.length > 0) {
        console.log("\n최초 5개 거래처:");
        clients.slice(0, 5).forEach((c, idx) => {
          console.log(`  ${idx + 1}. ${c.거래처명} (${c.거래처코드}) - ${c.전화번호}`);
        });
        if (clients.length > 5) console.log(`  ... 외 ${clients.length - 5}개`);
      } else if (clients.raw) {
        console.log("원본 응답:", JSON.stringify(clients.raw, null, 2));
      }
    } catch (err) {
      console.error("❌ 거래처 조회 실패:", err.message);
    }

    // 2. 재고(제품) 목록 조회
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("2️⃣ 제품/재고 목록 조회");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
      const inventory = await getInventory("segwang", "");
      console.log(`총 제품 수: ${inventory.length || 0}`);
      if (inventory && inventory.length > 0) {
        console.log("\n최초 10개 제품:");
        inventory.slice(0, 10).forEach((item, idx) => {
          console.log(
            `  ${idx + 1}. ${item.품목명} (${item.품목코드}) - 창고: ${item.창고}, 재고: ${item.재고수량}`
          );
        });
        if (inventory.length > 10) console.log(`  ... 외 ${inventory.length - 10}개`);
      } else if (inventory.raw) {
        console.log("원본 응답:", JSON.stringify(inventory.raw, null, 2));
      }
    } catch (err) {
      console.error("❌ 재고 조회 실패:", err.message);
    }

    // 3. 탁자/제조 관련 제품 필터링
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("3️⃣ 탁자/제조 관련 제품 검색");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
      const tableProducts = await getInventory("segwang", "탁자");
      console.log(`탁자 관련 제품: ${tableProducts.length || 0}개`);
      if (tableProducts && tableProducts.length > 0) {
        tableProducts.slice(0, 10).forEach((item, idx) => {
          console.log(
            `  ${idx + 1}. ${item.품목명} (${item.품목코드}) - 재고: ${item.재고수량}`
          );
        });
      }
    } catch (err) {
      console.error("❌ 탁자 제품 검색 실패:", err.message);
    }

    // 4. 원재료 관련 제품
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("4️⃣ 원재료/부품 관련 제품");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const keywords = ["목재", "부품", "재료", "다리", "판"];
    for (const keyword of keywords) {
      try {
        const results = await getInventory("segwang", keyword);
        if (results && results.length > 0) {
          console.log(`\n'${keyword}' 관련 (${results.length}개):`);
          results.slice(0, 5).forEach((item) => {
            console.log(`  • ${item.품목명} (${item.품목코드})`);
          });
          if (results.length > 5) console.log(`  ... 외 ${results.length - 5}개`);
        }
      } catch (e) {
        // 무시
      }
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ 분석 완료");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  } catch (err) {
    console.error("전체 분석 중 오류:", err);
  }
}

analyzeSegwangAccount();
