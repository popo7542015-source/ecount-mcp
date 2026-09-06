require("dotenv").config();
const path = require("path");
const express = require("express");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { z } = require("zod");
const { getInventory, getClient, rawCall } = require("./ecount");
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
        "품목명(또는 품목코드) 일부를 입력하면 오딘 또는 세광의 실시간 재고 수량을 조회합니다.",
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
  const meetingId = meeting.startMeeting(req.body?.topic);
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
