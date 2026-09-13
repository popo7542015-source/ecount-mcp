// 이카운트 호출 제한 부품(ecountLimits.js) 시험.
// 이카운트 서버에 실제로 접속하지 않는다 — 가짜 호출 함수로 규칙만 검증한다.
// 실행: npm test

const assert = require("assert");
const limits = require("../ecountLimits");

let 통과 = 0;
async function 시험(이름, fn) {
  limits._resetAll();
  await fn();
  통과 += 1;
  console.log(`  ok  ${이름}`);
}

(async () => {
  await 시험("경로를 보고 제한 종류를 고른다", async () => {
    assert.strictEqual(limits.classifyPath("/OAPI/V2/Zone"), "zone");
    assert.strictEqual(limits.classifyPath("/OAPI/V2/OAPILogin"), "login");
    assert.strictEqual(
      limits.classifyPath("/OAPI/V2/InventoryBasic/GetBasicProductsList"),
      "list"
    );
    assert.strictEqual(
      limits.classifyPath("/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatus"),
      "list"
    );
    assert.strictEqual(
      limits.classifyPath("/OAPI/V2/InventoryBasic/ViewBasicProduct"),
      "single"
    );
    assert.strictEqual(limits.classifyPath("/OAPI/V2/GoodsReceipt/SaveGoodsReceipt"), "save");
    assert.strictEqual(limits.classifyPath("/OAPI/V2/Sale/SaveSale"), "save");
    // 모르는 경로는 가장 보수적인 단건조회로 본다.
    assert.strictEqual(limits.classifyPath("/OAPI/V2/뭔가/Unknown"), "single");
  });

  await 시험("목록조회는 10분 안에 다시 부르면 이카운트를 치지 않고 캐시를 준다", async () => {
    let 호출수 = 0;
    const 가짜 = async () => {
      호출수 += 1;
      return { Data: { Result: [{ PROD_CD: "test001", BAL_QTY: "1.0000000000" }] } };
    };
    const path = "/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatusByLocation";
    const 첫번째 = await limits.withLimit(path, { BASE_DATE: "20260913" }, 가짜);
    const 두번째 = await limits.withLimit(path, { BASE_DATE: "20260913" }, 가짜);
    assert.strictEqual(호출수, 1, "두 번째는 이카운트를 부르면 안 됨");
    assert.strictEqual(첫번째.meta.cached, false);
    assert.strictEqual(두번째.meta.cached, true);
    assert.ok(두번째.meta.cachedAt > 0, "언제 받은 자료인지 알려줘야 함");
    assert.deepStrictEqual(두번째.data, 첫번째.data);
  });

  await 시험("같은 목록 API라도 조회 조건(날짜 등)이 다르면 캐시를 따로 잡고, 간격은 지킨다", async () => {
    limits.LIMITS.list.minIntervalMs = 200; // 실제는 10분. 시험에서는 0.2초로 줄여 동작만 본다.
    try {
      let 호출수 = 0;
      const 가짜 = async () => (호출수 += 1, { Data: { Result: [호출수] } });
      const path = "/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatusByLocation";
      const 시작 = Date.now();
      const 어제 = await limits.withLimit(path, { BASE_DATE: "20260912" }, 가짜);
      const 오늘 = await limits.withLimit(path, { BASE_DATE: "20260913" }, 가짜);
      const 걸린시간 = Date.now() - 시작;
      assert.strictEqual(호출수, 2, "조건이 다르면 캐시가 섞이지 않고 각각 한 번씩 부름");
      assert.notDeepStrictEqual(오늘.data, 어제.data, "다른 조건의 답이 섞이면 안 됨");
      assert.strictEqual(오늘.meta.cached, false);
      assert.ok(걸린시간 >= 190, `같은 API는 조건이 달라도 간격을 지켜야 함: ${걸린시간}ms`);
    } finally {
      limits.LIMITS.list.minIntervalMs = 10 * 60 * 1000;
    }
  });

  await 시험("목록조회 재조회가 실패하면 지난 캐시라도 알려주고 버틴다", async () => {
    const path = "/OAPI/V2/InventoryBasic/GetBasicProductsList";
    limits.LIMITS.list.minIntervalMs = 50; // 시험용으로 간격만 줄임
    try {
      await limits.withLimit(path, {}, async () => ({ Data: { Result: [1] } }));
      await new Promise((r) => setTimeout(r, 60));
      const 결과 = await limits.withLimit(path, {}, async () => {
        throw new Error("이카운트 호출 횟수 초과(HTTP 412)");
      });
      assert.strictEqual(결과.meta.stale, true);
      assert.deepStrictEqual(결과.data, { Data: { Result: [1] } });
      assert.ok(결과.meta.error.includes("412"));
    } finally {
      limits.LIMITS.list.minIntervalMs = 10 * 60 * 1000;
    }
  });

  await 시험("저장 API는 줄을 세워 정해진 간격을 지킨다", async () => {
    limits.LIMITS.save.minIntervalMs = 300; // 실제는 10초. 시험에서는 0.3초로 줄여 동작만 본다.
    try {
      const 시각 = [];
      const 저장 = () =>
        limits.withLimit("/OAPI/V2/GoodsReceipt/SaveGoodsReceipt", {}, async () => {
          시각.push(Date.now());
          return { Data: { SuccessCnt: 1, FailCnt: 0 } };
        });
      const 시작 = Date.now();
      await Promise.all([저장(), 저장(), 저장()]);
      assert.strictEqual(시각.length, 3);
      assert.ok(시각[1] - 시각[0] >= 290, `1→2 간격 부족: ${시각[1] - 시각[0]}ms`);
      assert.ok(시각[2] - 시각[1] >= 290, `2→3 간격 부족: ${시각[2] - 시각[1]}ms`);
      assert.ok(Date.now() - 시작 >= 580);
    } finally {
      limits.LIMITS.save.minIntervalMs = 10 * 1000;
    }
  });

  await 시험("저장 하나가 실패해도 뒤에 선 저장이 막히지 않는다", async () => {
    limits.LIMITS.save.minIntervalMs = 100;
    try {
      const 첫번째 = limits
        .withLimit("/OAPI/V2/Sale/SaveSale", {}, async () => {
          throw new Error("저장 실패");
        })
        .catch((e) => e.message);
      const 두번째 = limits.withLimit("/OAPI/V2/Sale/SaveSale", {}, async () => "저장됨");
      assert.strictEqual(await 첫번째, "저장 실패");
      assert.strictEqual((await 두번째).data, "저장됨");
    } finally {
      limits.LIMITS.save.minIntervalMs = 10 * 1000;
    }
  });

  await 시험("조회는 API 경로마다 따로 센다(품목조회 때문에 재고조회가 막히지 않음)", async () => {
    let 호출수 = 0;
    const 가짜 = async () => (호출수 += 1, { ok: true });
    await limits.withLimit("/OAPI/V2/InventoryBasic/GetBasicProductsList", {}, 가짜);
    await limits.withLimit("/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatus", {}, 가짜);
    assert.strictEqual(호출수, 2, "다른 API는 서로 기다리지 않아야 함");
  });

  await 시험("Zone·로그인은 10분 안에 다시 부르면 기다리지 않고 거절한다", async () => {
    await limits.withLimit("/OAPI/V2/OAPILogin", {}, async () => ({ ok: true }));
    await assert.rejects(
      () => limits.withLimit("/OAPI/V2/OAPILogin", {}, async () => ({ ok: true })),
      /10분에 1회/
    );
  });

  await 시험("로그인 연속 3회 실패면 스스로 멈추고, 그 뒤로는 호출조차 안 한다", async () => {
    const 알림 = [];
    const 원래 = console.error;
    console.error = (t) => 알림.push(t);
    try {
      limits.recordLoginFailure("odin", "오딘", "인증키 무효(201)");
      limits.recordLoginFailure("odin", "오딘", "인증키 무효(201)");
      limits.assertLoginAllowed("odin", "오딘"); // 2회까지는 통과
      const rec = limits.recordLoginFailure("odin", "오딘", "인증키 무효(201)");
      assert.strictEqual(rec.failures, 3);
      assert.ok(rec.lockedAt, "3회째에 자동 중단되어야 함");
    } finally {
      console.error = 원래;
    }
    assert.ok(알림.some((t) => t.includes("자동 중단")), "운영자 알림이 남아야 함");
    assert.throws(() => limits.assertLoginAllowed("odin", "오딘"), /자동으로 중단/);
    // 원인을 고친 뒤 해제하면 다시 쓸 수 있다.
    assert.deepStrictEqual(limits.resetLoginLock("odin"), { 회사: "odin", 해제됨: true });
    limits.assertLoginAllowed("odin", "오딘");
  });

  await 시험("로그인에 성공하면 실패 누계가 0으로 돌아간다", async () => {
    limits.recordLoginFailure("segwang", "세광", "일시 오류");
    limits.recordLoginFailure("segwang", "세광", "일시 오류");
    limits.recordLoginSuccess("segwang");
    limits.recordLoginFailure("segwang", "세광", "일시 오류");
    limits.assertLoginAllowed("segwang", "세광"); // 누계가 1이므로 통과해야 함
  });

  await 시험("접속 정보가 비었거나 잘렸으면 로그인 호출 자체를 안 한다", async () => {
    assert.throws(
      () => limits.validateCredentials("odin", { label: "오딘", comCode: "", userId: "x", apiCertKey: "y" }),
      /ODIN_COM_CODE 값이 비어 있음/
    );
    assert.throws(
      () =>
        limits.validateCredentials("odin", {
          label: "오딘",
          comCode: "53258",
          userId: "전 병태",
          apiCertKey: "a".repeat(30),
        }),
      /공백/
    );
    assert.throws(
      () =>
        limits.validateCredentials("odin", {
          label: "오딘",
          comCode: "53258",
          userId: "odin",
          apiCertKey: "짧은키",
        }),
      /길이가 너무 짧음/
    );
    // 정상값은 통과
    limits.validateCredentials("odin", {
      label: "오딘",
      comCode: "53258",
      userId: "odin",
      apiCertKey: "a".repeat(34),
    });
  });

  await 시험("상태 조회에 제한 현황·캐시 시각·로그인 상태가 담긴다", async () => {
    await limits.withLimit("/OAPI/V2/InventoryBasic/GetBasicProductsList", {}, async () => ({
      Data: { Result: [] },
      QUANTITY_INFO: { DAY_COUNT: 12 },
    }));
    limits.recordLoginFailure("odin", "오딘", "시험용 실패");
    const s = limits.getStatus();
    assert.ok(s.호출제한.목록조회.현황.length >= 1);
    assert.strictEqual(s.목록캐시.보관건수, 1);
    assert.ok(s.목록캐시.항목[0].받은시각);
    assert.strictEqual(s.로그인상태.odin.연속실패, 1);
    assert.deepStrictEqual(s.이카운트사용량.info, { DAY_COUNT: 12 });
  });

  console.log(`\n시험 ${통과}건 전부 통과`);
})().catch((err) => {
  console.error("\n시험 실패:", err.message);
  process.exit(1);
});
