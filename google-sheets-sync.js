#!/usr/bin/env node

/**
 * Google Sheets Sync Script
 * 5가지 AI 자동화 아이디어를 Google Sheets에 입력하는 스크립트
 */

const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");

// 환경 변수에서 설정 로드
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  : null;

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

// 5가지 자동화 아이디어
const AUTOMATION_IDEAS = [
  {
    description: "상세페이지 + 카카오톡 자동화",
    category: "Kakao Automation",
    status: "✅ 완료",
    techStack: "Node.js, Playwright, Claude API, Kakao Talk API",
    requiredEnvironment: "Kakao Business API Key, Anthropic API Key",
    estimatedCost: "$100/월",
    actionItems:
      "1. Playwright로 상세페이지 크롤링\n2. Claude API로 마케팅 문구 생성\n3. 카카오톡 알림톡으로 자동 발송",
    expectedEffect: "월간 영업 건수 20% 증가, 응답율 50% 개선",
    estimatedMonthlyRevenue: "500만원",
    completionDate: "2024-08-20",
  },
  {
    description: "프랜차이즈 신규 오픈 자동 영업",
    category: "Sales Automation",
    status: "✅ 코드 완료",
    techStack:
      "Node.js, 6-Agent Pipeline, Claude API, Google Sheets, Solapi",
    requiredEnvironment:
      "Anthropic API Key, Google Service Account, Solapi Key, Make.com",
    estimatedCost: "$250/월",
    actionItems:
      "1. 신규 오픈 정보 자동 감지\n2. 업종별 맞춤 영업 제안 생성\n3. 시공사 우선 발송 전략\n4. 성과 분석 & 최적화",
    expectedEffect: "월간 영업 매출 2억원 → 4~5억원 (3개월 내 회수 가능)",
    estimatedMonthlyRevenue: "2억원",
    completionDate: "2024-09-15",
  },
  {
    description: "멀티에이전트 마케팅 자동화",
    category: "Marketing Automation",
    status: "⏳ 개발 중",
    techStack: "Claude API (Opus 5), Multi-Agent Architecture, PostgreSQL",
    requiredEnvironment: "Claude API Key, PostgreSQL Database, Redis",
    estimatedCost: "$150/월",
    actionItems:
      "1. 콘텐츠 전략 에이전트\n2. SNS 포스팅 자동화 에이전트\n3. 고객 세그먼테이션 에이전트\n4. 성과 추적 에이전트",
    expectedEffect:
      "소셜 미디어 참여도 40% 증가, 리드 생성 3배 증가, 마케팅 비용 30% 절감",
    estimatedMonthlyRevenue: "1억원",
    completionDate: "2024-10-15",
  },
  {
    description: "이미지 크롤링 + 배경제거 자동화",
    category: "Image Processing",
    status: "💡 기획 중",
    techStack: "Python, Selenium, OpenCV, FastAPI, Redis",
    requiredEnvironment: "Python 3.10+, GPU (선택), S3 Storage",
    estimatedCost: "$50/월",
    actionItems:
      "1. 웹사이트 이미지 대량 크롤링\n2. AI 기반 배경 자동 제거\n3. 썸네일 자동 생성\n4. CDN에 최적화된 이미지 저장",
    expectedEffect: "이미지 처리 시간 90% 단축, 처리량 10배 증가",
    estimatedMonthlyRevenue: "3천만원",
    completionDate: "2024-11-15",
  },
  {
    description: "Claude Code 화면공유 제안",
    category: "Feature Proposal",
    status: "📋 제안 대기",
    techStack: "Claude Code, WebRTC, Real-time Sync",
    requiredEnvironment: "Anthropic Infrastructure",
    estimatedCost: "$0 (Anthropic 제공)",
    actionItems:
      "1. Claude Code 팀에 화면공유 기능 제안\n2. 실시간 협업 UX 설계\n3. 보안 및 성능 요구사항 분석",
    expectedEffect: "Claude Code 사용자 경험 향상, 팀 협업 효율성 60% 증가",
    estimatedMonthlyRevenue: "데이터 불가 (Anthropic 제안)",
    completionDate: "2025-01-15",
  },
];

async function main() {
  try {
    if (!GOOGLE_SERVICE_ACCOUNT_JSON || !GOOGLE_SHEET_ID) {
      console.error(
        "❌ 환경변수 오류: GOOGLE_SERVICE_ACCOUNT_JSON 또는 GOOGLE_SHEET_ID가 설정되지 않음"
      );
      console.error("다음을 .env 파일에 추가하세요:");
      console.error("GOOGLE_SERVICE_ACCOUNT_JSON={...}");
      console.error("GOOGLE_SHEET_ID=your_sheet_id");
      process.exit(1);
    }

    console.log("🔌 Google Sheets 연결 중...");

    // Google Sheets 클라이언트 초기화
    const auth = new JWT({
      email: GOOGLE_SERVICE_ACCOUNT_JSON.client_email,
      key: GOOGLE_SERVICE_ACCOUNT_JSON.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();

    // 워크시트 생성 또는 기존 워크시트 사용
    let sheet = doc.sheetsByTitle["AI자동화아이디어"] || null;

    if (!sheet) {
      console.log("📝 새 워크시트 생성 중...");
      sheet = await doc.addSheet({
        title: "AI자동화아이디어",
        headerValues: [
          "설명",
          "카테고리",
          "상태",
          "기술스택",
          "필요환경/비용",
          "액션항목",
          "예상효과",
          "월간 매출",
          "완료예정일",
        ],
      });
    }

    // 기존 행 지우기
    if (sheet.rowCount > 1) {
      console.log("🗑️  기존 데이터 삭제 중...");
      const rows = await sheet.getRows();
      for (const row of rows) {
        await row.delete();
      }
    }

    // 데이터 입력
    console.log("📊 데이터 입력 중...");
    for (const idea of AUTOMATION_IDEAS) {
      await sheet.addRow({
        설명: idea.description,
        카테고리: idea.category,
        상태: idea.status,
        기술스택: idea.techStack,
        "필요환경/비용": `${idea.requiredEnvironment}\n비용: ${idea.estimatedCost}`,
        액션항목: idea.actionItems,
        예상효과: idea.expectedEffect,
        "월간 매출": idea.estimatedMonthlyRevenue,
        완료예정일: idea.completionDate,
      });
    }

    console.log("✅ 5개의 자동화 아이디어가 Google Sheets에 입력되었습니다!");
    console.log(`📌 Spreadsheet ID: ${GOOGLE_SHEET_ID}`);
    console.log(
      `📋 Sheet: https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}`
    );
  } catch (error) {
    console.error("❌ 오류 발생:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = AUTOMATION_IDEAS;
