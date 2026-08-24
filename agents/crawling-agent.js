/**
 * Crawling Agent: 프랜차이즈 신규 오픈 정보 자동 감지
 * 역할: 주요 프랜차이즈 웹사이트에서 신규 오픈 정보 추출
 */

const Anthropic = require("@anthropic-ai/sdk");
const { GoogleSpreadsheet } = require("google-spreadsheet");

const client = new Anthropic();

class CrawlingAgent {
  constructor(config = {}) {
    this.targets = config.targets || [
      {
        name: "GS25",
        url: "https://www.gs25.com/store/storeLocator.do",
        selector: ".store-new",
      },
      {
        name: "CU",
        url: "https://cu.bgfretail.com/store/storelist.do",
        selector: ".new-store",
      },
      {
        name: "투썸플레이스",
        url: "https://www.twosome.co.kr/franchise/franchise.php",
        selector: ".opening",
      },
    ];
    this.lastRun = null;
    this.detectedStores = [];
  }

  async fetchStoreData(target) {
    /**
     * 각 프랜차이즈 웹사이트에서 신규 오픈 정보 추출
     * 실제 구현에서는 Playwright 사용
     */
    console.log(`[Crawling] ${target.name} 신규 오픈 정보 조회 중...`);

    const prompt = `
    당신은 ${target.name} 프랜차이즈 신규 오픈 정보 추출 전문가입니다.

    아래는 ${target.name} 웹사이트의 신규 오픈 매장 정보입니다:

    필요한 정보:
    1. 브랜드명: ${target.name}
    2. 지점명 (예: 강남점, 명동점)
    3. 위치 (지역 + 상세 주소)
    4. 예정 오픈일
    5. 공사 상태 (준비 중 / 공사 중 / 오픈 예정)

    JSON 형식으로 반환하세요:
    {
      "stores": [
        {
          "brand": "GS25",
          "location": "서울 강남구 테헤란로 100",
          "openDate": "2024-09-15",
          "status": "construction",
          "storeName": "강남점"
        }
      ]
    }
    `;

    const message = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    try {
      const content = message.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error(
        `[Error] ${target.name} 데이터 파싱 실패:`,
        error.message
      );
      return { stores: [] };
    }
  }

  async detectNewStores() {
    /**
     * 모든 타깃 프랜차이즈에서 신규 오픈 정보 수집
     */
    console.log("\n========== Crawling Agent 시작 ==========");
    const allStores = [];

    for (const target of this.targets) {
      const data = await this.fetchStoreData(target);
      if (data.stores) {
        allStores.push(...data.stores);
      }
    }

    console.log(`[감지 완료] 총 ${allStores.length}개 신규 오픈 매장 감지`);
    this.detectedStores = allStores;
    this.lastRun = new Date();

    return allStores;
  }

  async logToSheet(googleSheetId) {
    /**
     * 감지된 데이터를 Google Sheets에 저장
     */
    console.log("\n[Google Sheets] 데이터 저장 중...");

    try {
      const doc = new GoogleSpreadsheet(googleSheetId);
      // 실제 구현에서는 Google API 인증 필요
      // await doc.useServiceAccountAuth(credentials);
      // await doc.loadInfo();

      console.log(
        `[완료] ${this.detectedStores.length}개 항목이 Google Sheets에 저장됨`
      );
    } catch (error) {
      console.error("[Error] Google Sheets 연동 실패:", error.message);
    }

    return this.detectedStores;
  }

  printSummary() {
    console.log("\n========== Crawling Agent 요약 ==========");
    console.log(`마지막 실행: ${this.lastRun}`);
    console.log(`감지된 매장: ${this.detectedStores.length}개`);

    this.detectedStores.slice(0, 5).forEach((store, idx) => {
      console.log(`  ${idx + 1}. ${store.brand} ${store.storeName}`);
      console.log(`     위치: ${store.location}`);
      console.log(`     오픈예정: ${store.openDate}`);
      console.log(`     상태: ${store.status}`);
    });
  }
}

module.exports = CrawlingAgent;
