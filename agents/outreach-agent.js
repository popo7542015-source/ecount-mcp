/**
 * Outreach Agent: 발송 최적화 및 채널 관리
 * 역할: "누구에게" "언제" "어떻게" 발송할지 결정
 */

class OutreachAgent {
  constructor() {
    this.channels = {
      kakaoTalk: {
        name: "카카오 알림톡",
        maxChars: 1000,
        requiresTemplate: true,
        costPerMessage: 10,
      },
      bizMessage: {
        name: "카카오 비즈메시지",
        maxChars: 500,
        requiresTemplate: false,
        costPerMessage: 15,
      },
      email: {
        name: "이메일",
        maxChars: 5000,
        requiresTemplate: false,
        costPerMessage: 0,
      },
      telegram: {
        name: "텔레그램",
        maxChars: 2000,
        requiresTemplate: false,
        costPerMessage: 0,
      },
    };

    this.sentLog = [];
  }

  determinePrimaryTarget(enrichedStore) {
    /**
     * 저장소 정보기반 1차 발송 대상 결정
     * 규칙: 이전 거래 시공사 > 점주 > 본부
     */

    if (enrichedStore.previousConstructionCompany) {
      return {
        type: "constructionCompany",
        name: enrichedStore.previousConstructionCompany,
        contact: enrichedStore.constructionPhone,
        priority: "PRIMARY",
        successRate: 0.7,
      };
    }

    if (enrichedStore.storeOwnerPhone) {
      return {
        type: "storeOwner",
        name: enrichedStore.storeName,
        contact: enrichedStore.storeOwnerPhone,
        priority: "SECONDARY",
        successRate: 0.4,
      };
    }

    return {
      type: "headquarters",
      name: `${enrichedStore.brand} 가맹본부`,
      contact: enrichedStore.headquartersEmail,
      priority: "TERTIARY",
      successRate: 0.25,
    };
  }

  optimizeSendTiming(pitch) {
    /**
     * 발송 일정 자동 계산
     * 규칙: 공사 중 30일 전 = 최고 성공률
     */

    const today = new Date();
    let sendSchedules = [];

    // Stage 1: 사전 접촉 (90일 전)
    if (pitch.scheduledSend.stage1.days > 30) {
      sendSchedules.push({
        stage: 1,
        sendDate: this.addDays(today, pitch.scheduledSend.stage1.days - 45),
        label: "사전 접촉",
        channel: "email",
        message: "포트폴리오 소개",
      });
    }

    // Stage 2: 긴급 제안 (30일 전) - 최고 성공률
    if (pitch.scheduledSend.stage2.days > 7) {
      sendSchedules.push({
        stage: 2,
        sendDate: this.addDays(today, pitch.scheduledSend.stage2.days - 25),
        label: "긴급 제안",
        channel: "kakaoTalk",
        message: "가구 구매 제안",
        priority: "HIGH",
      });
    }

    // Stage 3: 최후 확인 (7일 전)
    if (pitch.scheduledSend.stage3.days >= 0) {
      sendSchedules.push({
        stage: 3,
        sendDate: this.addDays(today, Math.max(0, pitch.scheduledSend.stage3.days - 7)),
        label: "최후 확인",
        channel: "bizMessage",
        message: "최종 문의",
        priority: "URGENT",
      });
    }

    return sendSchedules;
  }

  selectOptimalChannel(target, stage) {
    /**
     * 대상 + 단계별 최적 채널 선택
     */

    const channelPriority = {
      constructionCompany: ["kakaoTalk", "email", "bizMessage"],
      storeOwner: ["kakaoTalk", "bizMessage", "email"],
      headquarters: ["email", "kakaoTalk"],
    };

    const channels = channelPriority[target.type] || ["email", "kakaoTalk"];

    return {
      preferred: channels[0],
      fallback: channels[1],
      info: this.channels[channels[0]],
    };
  }

  async planOutreach(pitches, constructionDb = {}) {
    /**
     * 모든 제안에 대한 발송 계획 수립
     */
    console.log("\n========== Outreach Agent 시작 ==========");
    console.log(`발송 계획 대상: ${pitches.length}개`);

    const outreachPlans = [];

    for (const pitch of pitches) {
      // 임시 저장소 데이터 생성
      const mockStore = {
        brand: pitch.brand,
        storeName: pitch.storeName,
        location: pitch.location,
        category: pitch.category,
        previousConstructionCompany: constructionDb[pitch.location],
        storeOwnerPhone: null,
        headquartersEmail: `${pitch.brand}@contact.com`,
      };

      const primaryTarget = this.determinePrimaryTarget(mockStore);
      const sendSchedules = this.optimizeSendTiming(pitch);
      const channel = this.selectOptimalChannel(primaryTarget, 2);

      outreachPlans.push({
        pitchId: pitch.storeId,
        brand: pitch.brand,
        storeName: pitch.storeName,
        primaryTarget,
        sendSchedules,
        channel,
        estimatedCost:
          sendSchedules.length *
          (this.channels[channel.preferred]?.costPerMessage || 0),
      });
    }

    console.log(
      `[완료] ${outreachPlans.length}개 발송 계획 수립 완료`
    );
    console.log(
      `총 예상 발송 건수: ${outreachPlans.reduce((sum, p) => sum + p.sendSchedules.length, 0)}`
    );

    return outreachPlans;
  }

  async executeOutreach(plan, actualMessage) {
    /**
     * 실제 발송 실행 (시뮬레이션)
     */
    console.log(`\n[Sending] ${plan.brand} ${plan.storeName}`);
    console.log(`대상: ${plan.primaryTarget.name} (${plan.primaryTarget.type})`);
    console.log(`채널: ${plan.channel.info.name}`);

    const record = {
      timestamp: new Date(),
      pitchId: plan.pitchId,
      targetType: plan.primaryTarget.type,
      channel: plan.channel.preferred,
      status: "sent",
      messageLength: actualMessage.length,
      estimatedSuccessRate: plan.primaryTarget.successRate,
    };

    this.sentLog.push(record);

    return record;
  }

  addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  printSchedule(outreachPlans) {
    console.log("\n========== 발송 일정 ==========");

    // 채널별 통계
    const byChannel = {};
    const byTarget = {};

    outreachPlans.forEach((plan) => {
      plan.sendSchedules.forEach((schedule) => {
        byChannel[schedule.channel] =
          (byChannel[schedule.channel] || 0) + 1;
      });
      byTarget[plan.primaryTarget.type] =
        (byTarget[plan.primaryTarget.type] || 0) + 1;
    });

    console.log("\n채널별 발송:");
    Object.entries(byChannel).forEach(([ch, count]) => {
      console.log(
        `  - ${this.channels[ch]?.name || ch}: ${count}건`
      );
    });

    console.log("\n대상별 발송:");
    Object.entries(byTarget).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}건`);
    });

    console.log("\n예상 성공률 분석:");
    const primary = outreachPlans.filter(
      (p) => p.primaryTarget.type === "constructionCompany"
    ).length;
    const secondary = outreachPlans.filter(
      (p) => p.primaryTarget.type === "storeOwner"
    ).length;

    console.log(
      `  - 시공사 우선 (70% 성공): ${primary}건`
    );
    console.log(`  - 점주 (40% 성공): ${secondary}건`);
  }
}

module.exports = OutreachAgent;
