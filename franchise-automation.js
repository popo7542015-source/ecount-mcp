#!/usr/bin/env node

/**
 * B2B 가구 프랜차이즈 자동 영업 시스템
 * 전체 파이프라인 통합 스크립트
 */

const ManagementAgent = require("./agents/management-agent");

async function main() {
  // 공장 정보 설정
  const factoryConfig = {
    name: "가구 공장",
    phone: "010-1234-5678",
    specialties: [
      "36T LPM 카페 테이블",
      "불판 원탁",
      "커스텀 가구",
    ],
    advantages: [
      "직영 단가 (유통 마진 0)",
      "납기 보장 (60일 충분)",
      "무상 설치 지도",
      "AS 365일 운영",
    ],
    portfolio: "https://portfolio.gagucafe114.com",
  };

  // 크롤링 타깃 설정
  const crawlingConfig = {
    targets: [
      {
        name: "투썸플레이스",
        url: "https://www.twosome.co.kr/franchise",
      },
      {
        name: "이디야",
        url: "https://www.ediya.com/franchise",
      },
      {
        name: "빽다방",
        url: "https://www.baekcoffee.com/franchise",
      },
      {
        name: "GS25",
        url: "https://www.gs25.com/store",
      },
      {
        name: "CU",
        url: "https://cu.bgfretail.com",
      },
    ],
  };

  // Management Agent 초기화
  const manager = new ManagementAgent({
    factory: factoryConfig,
    crawling: crawlingConfig,
  });

  // 파이프라인 실행
  await manager.executeFullPipeline();

  // 시스템 상태 출력
  manager.printSystemStatus();
}

// CLI 실행
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

module.exports = ManagementAgent;
