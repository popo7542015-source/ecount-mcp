/**
 * Sales Pitch Agent: 맞춤형 영업 제안 자동 생성
 * 역할: 업종별/지역별 맞춤 카카오톡 메시지 생성
 */

const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic();

class SalesPitchAgent {
  constructor(factoryInfo = {}) {
    this.factoryInfo = {
      name: "가구 공장",
      phone: "010-XXXX-XXXX",
      specialties: ["36T LPM 카페 테이블", "불판 원탁", "커스텀 가구"],
      advantages: [
        "직영 단가 (유통 마진 0)",
        "납기 보장 (60일 충분)",
        "무상 설치 지도",
        "AS 365일 운영",
      ],
      portfolio: "https://portfolio.example.com",
      ...factoryInfo,
    };

    this.templates = {
      카페: this.generateCafePitch.bind(this),
      고깃집: this.generateMeatRestaurantPitch.bind(this),
      호프펍: this.generateBarPitch.bind(this),
      편의점: this.generateConveniencePitch.bind(this),
    };
  }

  async generateCafePitch(store, needs) {
    /**
     * 카페 맞춤 제안 생성
     */
    const prompt = `
    카페 오픈을 축하하는 가구 영업 제안을 작성하세요.

    매장 정보:
    - 브랜드: ${store.brand}
    - 지점: ${store.storeName}
    - 위치: ${store.location}
    - 오픈: ${store.openDate}

    필요 가구:
    - 테이블: ${needs.tables}개 (${needs.specs})
    - 의자: ${needs.chairs}개 (북유럽 감성)
    - 카운터: 2개

    공장 정보:
    - ${this.factoryInfo.advantages.join("\n    - ")}

    카카오톡 친구톡 메시지 (100~150자) 작성:
    - 매력적인 오프닝
    - 핵심 상품 3줄
    - CTA (전화/문의)
    `;

    const message = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    return message.content[0].text;
  }

  async generateMeatRestaurantPitch(store, needs) {
    /**
     * 고깃집 맞춤 제안
     */
    const prompt = `
    고깃집 오픈을 축하하는 가구 영업 제안을 작성하세요.

    매장 정보:
    - 브랜드: ${store.brand}
    - 지점: ${store.storeName}
    - 위치: ${store.location}

    필요 가구:
    - 불판 원탁: ${needs.tables}개 (900Φ)
    - 의자: ${needs.chairs}개 (가죽 처리)
    - 특수: 환기 다리 구조

    강점:
    - 불판 하중 테스트 완료
    - 환기 구조 최적화
    - 빠른 납기

    카카오톡 메시지 작성:
    `;

    const message = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    return message.content[0].text;
  }

  async generateBarPitch(store, needs) {
    const prompt = `
    호프/펍 오픈을 축하하는 가구 영업 제안.

    하이 테이블 ${needs.tables}개 + 바 스툴 ${needs.chairs}개 제안.
    LED 조명 호환 구조 강조.
    `;

    const message = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    return message.content[0].text;
  }

  async generateConveniencePitch(store, needs) {
    const prompt = `
    편의점 확장 오픈 축하 제안.

    컬러 선반 테이블 ${needs.tables}개.
    POP 진열 최적화.
    `;

    const message = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    return message.content[0].text;
  }

  async generatePitch(store) {
    /**
     * 저장소 카테고리에 따라 적절한 제안 생성
     */
    console.log(`[Pitch] ${store.brand} ${store.storeName} 제안 생성 중...`);

    const generator =
      this.templates[store.category] || this.generateCafePitch.bind(this);

    const pitch = await generator(store, store.estimatedNeeds);

    return {
      storeId: `${store.brand}_${store.storeName}`,
      brand: store.brand,
      storeName: store.storeName,
      location: store.location,
      category: store.category,
      pitch: pitch,
      targets: this.generateTargets(store),
      scheduledSend: this.calculateSendTiming(store),
    };
  }

  generateTargets(store) {
    /**
     * 발송 대상 결정 (1차: 시공사, 2차: 점주, 3차: 본부)
     */
    const targets = {
      primary: {
        type: "constructionCompany",
        description: "지역 시공사 (신뢰도 높음)",
        priority: 1,
      },
      secondary: {
        type: "storeOwner",
        description: "가맹점주 (공개 연락처)",
        priority: 2,
      },
      tertiary: {
        type: "headquarters",
        description: "가맹본부 (인테리어 담당)",
        priority: 3,
      },
    };

    return targets;
  }

  calculateSendTiming(store) {
    /**
     * 발송 최적 시점 계산
     */
    const daysUntilOpen = store.daysUntilOpen;

    let timing = {
      stage1: { days: daysUntilOpen - 45, label: "사전 접촉" },
      stage2: { days: daysUntilOpen - 25, label: "긴급 제안" },
      stage3: { days: daysUntilOpen - 7, label: "최후 확인" },
    };

    return timing;
  }

  async generateBatch(enrichedStores) {
    /**
     * 여러 매장용 제안 일괄 생성
     */
    console.log("\n========== Sales Pitch Agent 시작 ==========");
    console.log(`제안 생성 대상: ${enrichedStores.length}개`);

    const pitches = [];

    for (const store of enrichedStores) {
      if (store.shouldContact) {
        const pitch = await this.generatePitch(store);
        pitches.push(pitch);
      }
    }

    console.log(`[완료] ${pitches.length}개 맞춤 제안 생성 완료`);

    return pitches;
  }

  printSample(pitches) {
    if (pitches.length === 0) return;

    console.log("\n========== 생성된 제안 샘플 ==========");
    const sample = pitches[0];

    console.log(`\n브랜드: ${sample.brand} ${sample.storeName}`);
    console.log(`위치: ${sample.location}`);
    console.log(`카테고리: ${sample.category}`);
    console.log(`\n제안 내용:\n${sample.pitch.substring(0, 300)}...`);
    console.log(`\n발송 대상:`);
    Object.entries(sample.targets).forEach(([key, target]) => {
      console.log(`  ${key}: ${target.description}`);
    });
    console.log(`\n발송 일정:`);
    Object.entries(sample.scheduledSend).forEach(([stage, timing]) => {
      if (timing.days > 0) {
        console.log(`  ${timing.label}: ${timing.days}일 후`);
      }
    });
  }
}

module.exports = SalesPitchAgent;
