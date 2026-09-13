require("dotenv").config();
const path = require("path");
const express = require("express");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { z } = require("zod");
const { getInventory, getClient, rawCall, getApiStatus, resetLoginLock } = require("./ecount");
const meeting = require("./meeting");
const { buildProviders } = require("./providers");

function buildServer() {
  const server = new McpServer({
    name: "ecount-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "ecount_get_inventory",
    {
      title: "이카운트 재고 조회",
      description:
        "품목명(또는 품목코드) 일부를 입력하면 오딘 또는 세광의 재고 수량을 조회합니다. " +
        "이카운트가 재고 목록조회를 10분에 1회만 허용하므로 10분 이내 재조회는 캐시 자료가 나오며, 결과의 기준시각을 함께 알려줍니다.",
      inputSchema: {
        company: z
          .enum(["odin", "segwang"])
          .describe("조회할 회사: odin(오딘) 또는 segwang(세광)"),
        item_keyword: z.string().describe("품목명 또는 품목코드 일부 (예: 나비수인)"),
      },
    },
    async ({ company, item_keyword }) => {
      try {
        const result = await getInventory(company, item_keyword);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `오류: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "ecount_get_client",
    {
      title: "이카운트 거래처 조회",
      description:
        "거래처명 일부를 입력하면 오딘 또는 세광에 등록된 거래처 정보(전화번호, 담당자, 주소 등)를 조회합니다.",
      inputSchema: {
        company: z
          .enum(["odin", "segwang"])
          .describe("조회할 회사: odin(오딘) 또는 segwang(세광)"),
        client_keyword: z.string().describe("거래처명 일부 (예: 미소가구)"),
      },
    },
    async ({ company, client_keyword }) => {
      try {
        const result = await getClient(company, client_keyword);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `오류: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "ecount_api_status",
    {
      title: "이카운트 API 호출 상태 확인 / 로그인 잠금 해제",
      description:
        "이카운트 호출 제한(10분·1초·10초) 현황, 목록 캐시가 언제 받은 자료인지, 로그인 연속 실패로 자동 중단된 회사가 있는지 확인합니다. " +
        "reset_login_lock에 회사를 지정하면 접속 정보를 고친 뒤 자동 중단을 해제합니다.",
      inputSchema: {
        reset_login_lock: z
          .enum(["odin", "segwang"])
          .optional()
          .describe("자동 중단을 해제할 회사. 원인(회사코드·인증키·등록 IP)을 고친 뒤에만 사용하세요."),
      },
    },
    async ({ reset_login_lock }) => {
      try {
        const 해제 = reset_login_lock ? resetLoginLock(reset_login_lock) : null;
        const result = { ...(해제 ? { 잠금해제: 해제 } : {}), ...getApiStatus() };
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `오류: ${err.message}` }], isError: true };
      }
    }
  );

  server.registerTool(
    "ecount_raw_api",
    {
      title: "이카운트 API 직접 호출 (디버그용)",
      description:
        "개발/디버그용: 이카운트 오픈 API의 임의 경로를 직접 호출해 원본 응답(JSON)을 반환합니다. 새 기능을 붙이기 전에 엔드포인트와 응답 구조를 확인할 때 사용합니다.",
      inputSchema: {
        company: z
          .enum(["odin", "segwang"])
          .describe("호출할 회사: odin(오딘) 또는 segwang(세광)"),
        path: z
          .string()
          .describe("API 경로 (예: /OAPI/V2/InventoryBasic/GetBasicProductsList)"),
        body: z
          .string()
          .optional()
          .describe('요청 본문 JSON 문자열 (예: {"BASE_DATE":"20260903"}). 생략 가능'),
      },
    },
    async ({ company, path, body }) => {
      try {
        const result = await rawCall(company, path, body);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `오류: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  try {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // 무상태 모드 (매 요청마다 새 서버 인스턴스)
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP 요청 처리 오류:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  }
});

app.get("/", (req, res) => {
  res.send("Ecount MCP 서버가 동작 중입니다. Claude 커스텀 커넥터에서 /mcp 경로를 등록하세요.");
});

// ── AI 회의실 ──────────────────────────────────────────────
app.get("/meeting", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "meeting.html"));
});

app.get("/meeting/api/providers", (req, res) => {
  res.json({ participants: buildProviders().map((p) => ({ id: p.id, label: p.label })) });
});

app.post("/meeting/api/start", (req, res) => {
  const meetingId = meeting.startMeeting(req.body?.topic, req.body?.activeProviderIds);
  res.json(meeting.getState(meetingId));
});

app.get("/meeting/api/state", (req, res) => {
  try {
    res.json(meeting.getState(req.query.meetingId));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post("/meeting/api/round", async (req, res) => {
  try {
    const results = await meeting.runRound(req.body?.meetingId);
    res.json({ results });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/meeting/api/ask", async (req, res) => {
  try {
    const { meetingId, question, targetId } = req.body || {};
    const results = await meeting.ask(meetingId, question, targetId);
    res.json({ results });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/meeting/api/summarize", async (req, res) => {
  try {
    const record = await meeting.summarize(req.body?.meetingId);
    res.json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 비교 엔진: 지금까지 나온 AI별 답변을 공통의견/불일치/근거/가정/불확실성 등으로 구조화한다.
app.post("/meeting/api/compare", async (req, res) => {
  try {
    const record = await meeting.compare(req.body?.meetingId);
    res.json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 실무자 의견: 자유 텍스트를 회의 기록에 남긴다.
app.post("/meeting/api/note", (req, res) => {
  try {
    const { meetingId, author, note } = req.body || {};
    const entry = meeting.addReviewerNote(meetingId, author, note);
    res.json({ entry });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 대표 승인상태: 검토중/수정요청/보류/승인/기각 중 하나로 기록한다.
app.post("/meeting/api/status", (req, res) => {
  try {
    const { meetingId, status, note } = req.body || {};
    const result = meeting.setApprovalStatus(meetingId, status, note);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 구글 드라이브(자비스미팅테이블)에 이 회의 기록을 저장한다.
app.post("/meeting/api/save-to-drive", async (req, res) => {
  try {
    const result = await meeting.saveToDrive(req.body?.meetingId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 암행어사: 클로드 외 참석 AI들이 각자 독립적으로 결과물을 검수한다.
app.post("/meeting/api/audit", async (req, res) => {
  try {
    const { meetingId, content } = req.body || {};
    const results = await meeting.audit(meetingId, content);
    res.json({ results });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 회의실에서 쓰는 재고 빠른조회 (기존 이카운트 조회 도구 재사용, 읽기 전용)
app.post("/meeting/api/inventory", async (req, res) => {
  try {
    const { company, keyword } = req.body || {};
    const result = await getInventory(company, keyword);
    res.json({ result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Ecount MCP 서버 실행 중: 포트 ${PORT}`);
});
