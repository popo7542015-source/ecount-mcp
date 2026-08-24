/**
 * Data Enrichment Agent: 수집된 데이터 정제 및 분류
 * 역할: 브랜드/업종/지역/가구 필요량 자동 분류
 */

const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic();

class DataEnrichmentAgent {
  constructor() {
    this.categories = {
      카페: {
        tableCount: 20,
        chairCount: 80,
        specs: "36T LPM 1200x600",
        color: "밝은 톤",
      },
      고깃집: {
        tableCount: 15,
        chairCount: 60,
        specs: "불판 원탁 900Φ",
        color: "검정/갈색",
      },
      호프펍: {
        tableCount: 20,
        chairCount: 60,
        specs: "하이 테이블 1050mm",
        color: "모던톤",
      },
      편의점: {
        tableCount: 5,
        chairCount: 0,
        specs: "컬러 선반 테이블",
        color: "컬러풀",
      },
    };
  }

  async classifyBusiness(storeName, brand) {
    /**
     * 매장명 + 브랜드를 기반으로 업종 자동 분류
     */
    const prompt = `
    매장 정보를 기반으로 업종을 분류하세요.

    브랜드: ${brand}
    매장명: ${storeName}

    가능한 업종:
    - 카페
    - 고깃집
    - 호프/펍
    - 편의점
    - 기타

    JSON 형식으로 반환:
    {
      "category": "카페",
      "confidence": 0.95,
      "reason": "투썸플레이스는 카페 프랜차이즈"
    }
    `;

    const message = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    try {
      const jsonMatch = message.content[0].text.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch[0]);
    } catch {
      return { category: "기타", confidence: 0, reason: "분류 실패" };
    }
  }

  async estimateConstructionPhase(openDate) {
    /**
     * 오픈 예정일을 기반으로 현재 공사 단계 추정
     */
    const today = new Date();
    const open = new Date(openDate);
    const daysUntilOpen = Math.floor((open - today) / (1000 * 60 * 60 * 24));

    let phase, priority, recommendedTiming;

    if (daysUntilOpen > 60) {
      phase = "preparing";
      priority = "LOW";
      recommendedTiming = daysUntilOpen - 45; // 60~90일 전
    } else if (daysUntilOpen > 30) {
      phase = "construction";
      priority = "HIGH";
      recommendedTiming = daysUntilOpen - 25; // 30~45일 전
    } else if (daysUntilOpen > 14) {
      phase = "finalizing";
      priority = "URGENT";
      recommendedTiming = daysUntilOpen - 7; // 14~30일 전
    } else {
      phase = "opening";
      priority = "LATE";
      recommendedTiming = 0;
    }

    return { phase, priority, daysUntilOpen, recommendedTiming };
  }

  async enrichStore(store) {
    /**
     * 각 매장 정보에 분류/추정/필요량 데이터 추가
     */
    console.log(`[Enriching] ${store.brand} ${store.storeName}...`);

    const classification = await this.classifyBusiness(
      store.storeName,
      store.brand
    );
    const construction = await this.estimateConstructionPhase(
      store.openDate
    );

    const category = this.categories[classification.category] || {
      tableCount: 10,
      chairCount: 40,
      specs: "기본 테이블",
      color: "표준",
    };

    return {
      ...store,
      category: classification.category,
      categoryConfidence: classification.confidence,
      phase: construction.phase,
      priority: construction.priority,
      daysUntilOpen: construction.daysUntilOpen,
      estimatedNeeds: {
        tables: category.tableCount,
        chairs: category.chairCount,
        specs: category.specs,
        color: category.color,
        estimatedAmount: `${(category.tableCount * 1500000 + category.chairCount * 150000) / 1000000}백만원`,
      },
      shouldContact: construction.priority !== "LATE",
    };
  }

  async enrichBatch(stores) {
    /**
     * 여러 매장을 한 번에 처리
     */
    console.log("\n========== Data Enrichment Agent 시작 ==========");
    console.log(`처리 대상: ${stores.length}개 매장`);

    const enriched = [];

    for (const store of stores) {
      const result = await this.enrichStore(store);
      enriched.push(result);
    }

    console.log(`[완료] ${enriched.length}개 매장 분류 완료`);

    return enriched;
  }

  printSummary(enrichedStores) {
    console.log("\n========== Data Enrichment 요약 ==========");

    // 업종별 통계
    const byCategory = {};
    enrichedStores.forEach((store) => {
      byCategory[store.category] = (byCategory[store.category] || 0) + 1;
    });

    console.log("업종별 분포:");
    Object.entries(byCategory).forEach(([cat, count]) => {
      console.log(`  - ${cat}: ${count}개`);
    });

    // 우선순위별 통계
    const byPriority = {};
    enrichedStores.forEach((store) => {
      byPriority[store.priority] = (byPriority[store.priority] || 0) + 1;
    });

    console.log("\n우선순위별 분포:");
    Object.entries(byPriority).forEach(([pri, count]) => {
      console.log(`  - ${pri}: ${count}개`);
    });

    console.log("\n샘플 (상위 3개):");
    enrichedStores.slice(0, 3).forEach((store, idx) => {
      console.log(
        `  ${idx + 1}. ${store.brand} ${store.storeName} (${store.category})`
      );
      console.log(`     예상 필요: ${store.estimatedNeeds.specs} x${store.estimatedNeeds.tables}개`);
      console.log(`     예상 금액: ${store.estimatedNeeds.estimatedAmount}`);
    });
  }
}

module.exports = DataEnrichmentAgent;
