require("dotenv").config();
const express = require("express");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { z } = require("zod");
const { getInventory, getClient } = require("./ecount");

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Ecount MCP 서버 실행 중: 포트 ${PORT}`);
});
