// driveArchive.js
// 회의 기록을 구글 드라이브(자비스미팅테이블 > 02_AI_회의실 > 03_최종결론)에 저장하는 부품.
// GOOGLE_SERVICE_ACCOUNT_KEY 환경변수가 없으면 조용히 "설정 안 됨"으로 응답한다 —
// 설정 전에도 회의실 나머지 기능은 그대로 동작해야 하기 때문(자비스 스펙: 기존 구조 보존).

const { google } = require("googleapis");

// 자비스미팅테이블 > 02_AI_회의실 > 03_최종결론 (JARVIS_ClaudeCode_ALL_IN_ONE_한파일.md
// 04_EXISTING_DRIVE_STRUCTURE.md에 적힌 실제 폴더 ID). 다른 폴더에 저장하고 싶으면
// MEETING_DRIVE_FOLDER_ID 환경변수로 덮어쓸 수 있다.
const DEFAULT_FOLDER_ID = "1aUkkFGfTbHFMV6eG-RBp_uxBHOEz-gOs";

function isConfigured() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
}

let cachedDrive = null;
function getDrive() {
  if (!isConfigured()) return null;
  if (cachedDrive) return cachedDrive;
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  cachedDrive = google.drive({ version: "v3", auth });
  return cachedDrive;
}

// 회의 하나를 사람이 읽기 쉬운 마크다운 한 장으로 정리한다.
// (자비스 스펙 3-2: "원문"과 "요약/추출"을 구분 — 여기서는 발언 원문을 그대로 남기고,
// 비교·요약은 이미 만들어둔 결과가 있으면 같이 붙인다.)
function buildMarkdown(meeting, meetingId) {
  const lines = [];
  lines.push(`# 회의 기록 — ${meeting.topic || "(주제 없음)"}`);
  lines.push("");
  lines.push(`- 회의 ID: ${meetingId}`);
  lines.push(`- 저장 시각: ${new Date().toISOString()}`);
  lines.push(`- 승인 상태: ${meeting.approvalStatus}`);
  lines.push(`- 참여 AI: ${(meeting.activeProviderIds || []).join(", ") || "(전체)"}`);
  lines.push("");
  lines.push("## 대화 전체 (원문)");
  for (const m of meeting.messages) {
    lines.push(`**[${m.label}]**`);
    lines.push(m.content);
    lines.push("");
  }
  if (meeting.lastComparison) {
    lines.push("## 비교 분석");
    lines.push("```json");
    lines.push(JSON.stringify(meeting.lastComparison.result, null, 2));
    lines.push("```");
    lines.push("");
  }
  if (meeting.lastSummary) {
    lines.push("## 요약");
    lines.push(meeting.lastSummary.summary);
    lines.push("");
  }
  return lines.join("\n");
}

async function saveMeetingToDrive(meeting, meetingId) {
  const drive = getDrive();
  if (!drive) {
    return {
      saved: false,
      reason:
        "구글 드라이브 저장이 아직 설정되지 않았습니다. Render 환경변수에 GOOGLE_SERVICE_ACCOUNT_KEY를 등록해야 합니다.",
    };
  }

  const content = buildMarkdown(meeting, meetingId);
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeTopicPart = (meeting.topic || "무제").replace(/[\\/:*?"<>|]/g, " ").slice(0, 30);
  const fileName = `${dateStr}_${safeTopicPart}_${meetingId.slice(0, 8)}.md`;
  const folderId = process.env.MEETING_DRIVE_FOLDER_ID || DEFAULT_FOLDER_ID;

  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId], mimeType: "text/markdown" },
    media: { mimeType: "text/markdown", body: content },
    fields: "id, webViewLink",
  });

  return { saved: true, fileId: res.data.id, url: res.data.webViewLink };
}

module.exports = { isConfigured, saveMeetingToDrive };
