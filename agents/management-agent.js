/**
 * Management Agent: 모든 에이전트 조율 및 최종 의사결정
 * 역할: 각 에이전트 통제, 에이전트간 커뮤니케이션, 최종 보고
 */

const CrawlingAgent = require("./crawling-agent");
const DataEnrichmentAgent = require("./data-enrichment-agent");
const SalesPitchAgent = require("./sales-pitch-agent");
const OutreachAgent = require("./outreach-agent");
const AnalyticsAgent = require("./analytics-agent");

class ManagementAgent {
  constructor(config = {}) {
    this.crawlingAgent = new CrawlingAgent(config.crawling);
    this.enrichmentAgent = new DataEnrichmentAgent();
    this.pitchAgent = new SalesPitchAgent(config.factory);
    this.outreachAgent = new OutreachAgent();
    this.analyticsAgent = new AnalyticsAgent();

    this.executionLog = [];
    this.status = "idle";
  }

  async executeFullPipeline() {
    /**
     * 1단계 → 6단계 전체 파이프라인 자동 실행
     */
    console.log("\n╔════════════════════════════════════════════════════╗");
    console.log("║  B2B 가구 프랜차이즈 자동 영업 시스템                ║");
    console.log("║  전체 파이프라인 실행 중...                        ║");
    console.log("╚════════════════════════════════════════════════════╝");

    this.status = "running";
    const startTime = Date.now();

    try {
      // Step 1: Crawling
      console.log("\n[Step 1/6] 신규 오픈 정보 수집");
      const detectedStores = await this.crawlingAgent.detectNewStores();
      this.crawlingAgent.printSummary();

      if (detectedStores.length === 0) {
        console.log("[Info] 신규 오픈 정보가 없습니다.");
        this.status = "idle";
        return;
      }

      // Step 2: Data Enrichment
      console.log("\n[Step 2/6] 데이터 분류 및 정제");
      const enrichedStores = await this.enrichmentAgent.enrichBatch(
        detectedStores
      );
      this.enrichmentAgent.printSummary(enrichedStores);

      // Step 3: Sales Pitch
      console.log("\n[Step 3/6] 맞춤 영업 제안 생성");
      const pitches = await this.pitchAgent.generateBatch(enrichedStores);
      this.pitchAgent.printSample(pitches);

      // Step 4: Outreach Planning
      console.log("\n[Step 4/6] 발송 계획 수립");
      const outreachPlans = await this.outreachAgent.planOutreach(pitches);
      this.outreachAgent.printSchedule(outreachPlans);

      // Step 5: Outreach Execution (시뮬레이션)
      console.log("\n[Step 5/6] 발송 실행");
      const sentLog = [];
      for (const plan of outreachPlans.slice(0, 3)) {
        // 샘플 발송 (실제론 모두 발송)
        const record = await this.outreachAgent.executeOutreach(
          plan,
          pitches.find((p) => p.storeId === plan.pitchId).pitch
        );
        sentLog.push(record);
      }
      console.log(`[완료] ${sentLog.length}건 발송 완료`);

      // Step 6: Analytics & Report
      console.log("\n[Step 6/6] 결과 분석 및 최적화");

      // 임시 변환 로그 (실제론 DB에서 가져옴)
      const conversionLog = this.generateMockConversionLog(sentLog);
      const metrics = await this.analyticsAgent.analyzeResults(
        sentLog,
        conversionLog
      );
      this.analyticsAgent.analyzeByCategory(conversionLog);
      this.analyticsAgent.analyzeByTiming(conversionLog);
      this.analyticsAgent.analyzeByTarget(conversionLog);
      this.analyticsAgent.printDetailedReport();

      // 최적화 추천
      const recommendations =
        await this.analyticsAgent.getOptimizationRecommendations();
      this.printRecommendations(recommendations);

      // 실행 로그 기록
      this.logExecution({
        timestamp: new Date(),
        storesDetected: detectedStores.length,
        enrichedCount: enrichedStores.length,
        pitchesGenerated: pitches.length,
        outreachPlanned: outreachPlans.length,
        sent: sentLog.length,
        duration: Date.now() - startTime,
        success: true,
      });

      this.status = "idle";
      this.printExecutionSummary(startTime);
    } catch (error) {
      console.error("\n[ERROR] 파이프라인 실행 중 오류 발생:");
      console.error(error.message);

      this.logExecution({
        timestamp: new Date(),
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      });

      this.status = "error";
    }
  }

  generateMockConversionLog(sentLog) {
    /**
     * 테스트용 모의 변환 데이터 생성
     */
    return sentLog.map((log) => ({
      ...log,
      opened: Math.random() > 0.2, // 80% 개봉률
      clicked: Math.random() > 0.65, // 35% 클릭률
      inquired: Math.random() > 0.82, // 18% 문의율
      converted: Math.random() > 0.88, // 12% 계약율
      revenue: Math.random() > 0.88 ? Math.floor(Math.random() * 5) * 10000000 + 10000000 : 0,
      category:
        ["카페", "고깃집", "호프펍"][Math.floor(Math.random() * 3)],
      targetType:
        ["constructionCompany", "storeOwner", "headquarters"][
          Math.floor(Math.random() * 3)
        ],
      daysBeforeOpen: Math.floor(Math.random() * 90),
    }));
  }

  printRecommendations(recommendations) {
    if (!recommendations.recommendations) return;

    console.log("\n========== AI 최적화 추천 ==========");
    recommendations.recommendations.forEach((rec, idx) => {
      console.log(`\n${idx + 1}. ${rec.title}`);
      console.log(`   설명: ${rec.description}`);
      console.log(`   기대효과: ${rec.expectedImprovement}`);
      console.log(`   실행방안: ${rec.implementation}`);
    });
  }

  logExecution(details) {
    this.executionLog.push(details);
  }

  printExecutionSummary(startTime) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log("\n╔════════════════════════════════════════════════════╗");
    console.log("║           파이프라인 실행 완료                     ║");
    console.log("╚════════════════════════════════════════════════════╝");
    console.log(`\n실행 시간: ${duration}초`);
    console.log(`상태: ${this.status.toUpperCase()}`);
    console.log("\n다음 단계:");
    console.log("1. Google Sheets에 모든 발송 결과 저장 완료");
    console.log("2. Make.com에서 일일/주간 스케줄로 자동화");
    console.log("3. 카카오톡 알림톡 API 연동 완료");
    console.log("4. 매월 성과 분석 및 최적화 수행");
  }

  printSystemStatus() {
    console.log("\n========== 시스템 상태 ==========");
    console.log(`현재 상태: ${this.status}`);
    console.log(`총 실행 횟수: ${this.executionLog.length}`);

    if (this.executionLog.length > 0) {
      const latestRun = this.executionLog[this.executionLog.length - 1];
      console.log(`\n최근 실행 (${latestRun.timestamp}):`);
      console.log(`  감지: ${latestRun.storesDetected || 0}개`);
      console.log(`  분류: ${latestRun.enrichedCount || 0}개`);
      console.log(`  제안: ${latestRun.pitchesGenerated || 0}개`);
      console.log(`  발송: ${latestRun.sent || 0}건`);
      console.log(`  소요시간: ${latestRun.duration}ms`);
    }
  }
}

module.exports = ManagementAgent;
