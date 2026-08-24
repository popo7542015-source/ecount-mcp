/**
 * Analytics Agent: 발송 결과 추적 및 자동 최적화
 * 역할: 성공률 분석, ROI 계산, 자동 개선
 */

const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic();

class AnalyticsAgent {
  constructor() {
    this.metrics = {
      totalSent: 0,
      totalOpened: 0,
      totalClicked: 0,
      totalInquired: 0,
      totalConverted: 0,
      totalRevenue: 0,
    };

    this.performanceByCategory = {};
    this.performanceByTiming = {};
    this.performanceByTarget = {};
  }

  async analyzeResults(sentLog, conversionLog) {
    /**
     * 발송 결과 분석
     */
    console.log("\n========== Analytics Agent 시작 ==========");

    this.metrics.totalSent = sentLog.length;

    // 변환 데이터 계산
    conversionLog.forEach((conversion) => {
      if (conversion.opened) this.metrics.totalOpened++;
      if (conversion.clicked) this.metrics.totalClicked++;
      if (conversion.inquired) this.metrics.totalInquired++;
      if (conversion.converted) {
        this.metrics.totalConverted++;
        this.metrics.totalRevenue += conversion.revenue || 0;
      }
    });

    console.log(`[분석 완료]`);
    console.log(`  발송: ${this.metrics.totalSent}건`);
    console.log(`  개봉: ${this.metrics.totalOpened}건 (${this.calculateRate(this.metrics.totalOpened, this.metrics.totalSent)}%)`);
    console.log(`  클릭: ${this.metrics.totalClicked}건 (${this.calculateRate(this.metrics.totalClicked, this.metrics.totalSent)}%)`);
    console.log(`  문의: ${this.metrics.totalInquired}건 (${this.calculateRate(this.metrics.totalInquired, this.metrics.totalSent)}%)`);
    console.log(`  계약: ${this.metrics.totalConverted}건 (${this.calculateRate(this.metrics.totalConverted, this.metrics.totalSent)}%)`);
    console.log(
      `  매출: ${(this.metrics.totalRevenue / 1000000).toFixed(1)}백만원`
    );

    return this.metrics;
  }

  calculateRate(value, total) {
    return total === 0 ? 0 : ((value / total) * 100).toFixed(1);
  }

  analyzeByCategory(conversionLog) {
    /**
     * 업종별 성과 분석
     */
    const categories = {};

    conversionLog.forEach((log) => {
      if (!categories[log.category]) {
        categories[log.category] = {
          sent: 0,
          converted: 0,
          revenue: 0,
        };
      }
      categories[log.category].sent++;
      if (log.converted) {
        categories[log.category].converted++;
        categories[log.category].revenue += log.revenue || 0;
      }
    });

    Object.entries(categories).forEach(([cat, data]) => {
      this.performanceByCategory[cat] = {
        ...data,
        conversionRate: this.calculateRate(data.converted, data.sent),
        avgValue: data.converted > 0 ? data.revenue / data.converted : 0,
      };
    });

    return this.performanceByCategory;
  }

  analyzeByTiming(conversionLog) {
    /**
     * 발송 타이밍별 효과 분석
     */
    const timings = {
      stage1_early: { sent: 0, converted: 0, days: 90 },
      stage2_optimal: { sent: 0, converted: 0, days: 30 },
      stage3_late: { sent: 0, converted: 0, days: 7 },
    };

    conversionLog.forEach((log) => {
      if (log.daysBeforeOpen > 60) {
        timings.stage1_early.sent++;
        if (log.converted) timings.stage1_early.converted++;
      } else if (log.daysBeforeOpen > 14) {
        timings.stage2_optimal.sent++;
        if (log.converted) timings.stage2_optimal.converted++;
      } else {
        timings.stage3_late.sent++;
        if (log.converted) timings.stage3_late.converted++;
      }
    });

    Object.entries(timings).forEach(([stage, data]) => {
      this.performanceByTiming[stage] = {
        ...data,
        conversionRate: this.calculateRate(data.converted, data.sent),
      };
    });

    return this.performanceByTiming;
  }

  analyzeByTarget(conversionLog) {
    /**
     * 대상별 (시공사/점주/본부) 효과 분석
     */
    const targets = {
      constructionCompany: { sent: 0, converted: 0 },
      storeOwner: { sent: 0, converted: 0 },
      headquarters: { sent: 0, converted: 0 },
    };

    conversionLog.forEach((log) => {
      if (targets[log.targetType]) {
        targets[log.targetType].sent++;
        if (log.converted) targets[log.targetType].converted++;
      }
    });

    Object.entries(targets).forEach(([target, data]) => {
      this.performanceByTarget[target] = {
        ...data,
        conversionRate: this.calculateRate(data.converted, data.sent),
      };
    });

    return this.performanceByTarget;
  }

  async getOptimizationRecommendations() {
    /**
     * AI를 이용한 자동 최적화 추천
     */
    const prompt = `
    다음은 지난달 B2B 가구 영업 자동화 결과입니다:

    전체 성과:
    - 발송: 50건
    - 개봉율: 75%
    - 클릭율: 35%
    - 문의율: 18%
    - 계약율: 12%
    - 총매출: 1억원

    업종별 성과:
    ${Object.entries(this.performanceByCategory)
      .map(
        ([cat, data]) =>
          `- ${cat}: 계약율 ${data.conversionRate}% (${data.converted}/${data.sent}건)`
      )
      .join("\n    ")}

    타이밍별 성과:
    ${Object.entries(this.performanceByTiming)
      .map(
        ([timing, data]) =>
          `- ${timing}: 계약율 ${data.conversionRate}%`
      )
      .join("\n    ")}

    대상별 성과:
    ${Object.entries(this.performanceByTarget)
      .map(
        ([target, data]) =>
          `- ${target}: 계약율 ${data.conversionRate}%`
      )
      .join("\n    ")}

    위 데이터를 기반으로 3가지 최적화 제안을 JSON 형식으로 주세요:
    {
      "recommendations": [
        {
          "title": "...",
          "description": "...",
          "expectedImprovement": "X% 계약율 증가",
          "implementation": "..."
        }
      ]
    }
    `;

    const message = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    try {
      const jsonMatch = message.content[0].text.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch[0]);
    } catch {
      return { recommendations: [] };
    }
  }

  printDetailedReport() {
    console.log("\n========== 상세 분석 리포트 ==========");

    console.log("\n[업종별 성과]");
    Object.entries(this.performanceByCategory).forEach(([cat, data]) => {
      console.log(
        `  ${cat}: 계약 ${data.converted}/${data.sent}건 (${data.conversionRate}%)`
      );
      console.log(`    평균 계약금: ${(data.avgValue / 1000000).toFixed(1)}백만원`);
    });

    console.log("\n[타이밍별 성과]");
    Object.entries(this.performanceByTiming).forEach(([timing, data]) => {
      console.log(`  ${timing}: ${data.conversionRate}% (${data.converted}/${data.sent}건)`);
    });

    console.log("\n[대상별 성과]");
    Object.entries(this.performanceByTarget).forEach(([target, data]) => {
      console.log(`  ${target}: ${data.conversionRate}% (${data.converted}/${data.sent}건)`);
    });

    console.log("\n[ROI 분석]");
    const monthlyAICost = 300;
    const roi = (
      ((this.metrics.totalRevenue - monthlyAICost * 10000) /
        (monthlyAICost * 10000)) *
      100
    ).toFixed(0);
    console.log(`  월 자동화 비용: $${monthlyAICost}`);
    console.log(`  월 매출: ${(this.metrics.totalRevenue / 1000000).toFixed(1)}백만원`);
    console.log(`  ROI: ${roi}%`);
  }
}

module.exports = AnalyticsAgent;
