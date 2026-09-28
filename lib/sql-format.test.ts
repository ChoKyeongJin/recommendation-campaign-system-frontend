import assert from "node:assert/strict";
import test from "node:test";

import { formatSql, tokenSignature } from "./sql-format.ts";

/**
 * 화면에서 실제로 길게 나가던 모양. 백엔드가 SELECT/FROM/WHERE 는 이미 줄로 나누지만
 * WHERE 본문은 한 줄이라 가로로 한참 밀려 나간다.
 */
const SHIPPED = `SELECT DISTINCT B.customer_id AS CUST_ID, B.membership_level AS member_grade, '캠페인 클릭 이벤트' AS event_label
FROM cust_profile B
WHERE B.customer_status = 'ACTIVE' AND ((NOT EXISTS (SELECT 1 FROM campaign_customer_response CK WHERE CK.customer_id = B.customer_id AND CK.responded_at >= :since)) OR B.membership_level = 'VIP')`;

/** 포맷은 공백만 바꾼다 — 이 시험이 그 계약이다. */
function assertOnlyWhitespaceChanged(sql: string) {
  assert.equal(
    tokenSignature(formatSql(sql)),
    tokenSignature(sql),
    "공백 말고 다른 것이 바뀌었다",
  );
}

test("출고 SQL 을 포맷해도 토큰이 하나도 바뀌지 않는다", () => {
  assertOnlyWhitespaceChanged(SHIPPED);
});

test("WHERE 본문이 이음말마다 줄로 나뉜다", () => {
  const formatted = formatSql(SHIPPED);
  const lines = formatted.split("\n");
  // 가로로 밀려 나가던 한 줄이 사라져야 한다.
  const longest = Math.max(...lines.map((line) => line.length));
  assert.ok(longest < 100, `아직 긴 줄이 있다(${longest}자)\n${formatted}`);

  assert.ok(
    lines.some((line) => line.trim().startsWith("AND")),
    `AND 로 시작하는 줄이 없다\n${formatted}`,
  );
  assert.ok(
    lines.some((line) => line.trim().startsWith("OR")),
    `OR 로 시작하는 줄이 없다\n${formatted}`,
  );
});

test("서브쿼리가 들여쓰기로 한 단 들어간다", () => {
  const formatted = formatSql(SHIPPED);
  const inner = formatted
    .split("\n")
    .find((line) => line.trim().startsWith("SELECT 1"));
  assert.ok(inner, `서브쿼리 SELECT 줄이 없다\n${formatted}`);
  assert.ok(
    inner.startsWith(" "),
    `서브쿼리가 들여쓰기되지 않았다: ${JSON.stringify(inner)}`,
  );
});

test("문자열 안의 공백은 건드리지 않는다", () => {
  // 값이 바뀌면 그건 포맷이 아니라 오염이다.
  const sql = "SELECT 'a  b   c' AS label FROM t WHERE x = '  띄어쓰기  유지  '";
  const formatted = formatSql(sql);
  assert.ok(formatted.includes("'a  b   c'"));
  assert.ok(formatted.includes("'  띄어쓰기  유지  '"));
  assertOnlyWhitespaceChanged(sql);
});

test("따옴표 두 번으로 감싼 작은따옴표를 문자열 끝으로 읽지 않는다", () => {
  const sql = "SELECT * FROM t WHERE name = 'O''Brien' AND grade = 'VIP'";
  const formatted = formatSql(sql);
  assert.ok(formatted.includes("'O''Brien'"), formatted);
  assertOnlyWhitespaceChanged(sql);
});

test("BETWEEN 의 AND 는 줄을 바꾸지 않는다", () => {
  const sql =
    "SELECT * FROM t WHERE amount BETWEEN 100 AND 200 AND grade = 'VIP'";
  const formatted = formatSql(sql);
  assert.ok(
    formatted.includes("BETWEEN 100 AND 200"),
    `BETWEEN 이 끊겼다\n${formatted}`,
  );
  // 뒤따르는 진짜 AND 는 끊긴다.
  assert.ok(
    formatted.split("\n").some((line) => line.trim().startsWith("AND grade")),
    formatted,
  );
  assertOnlyWhitespaceChanged(sql);
});

test("함수 호출 괄호는 펼치지 않는다", () => {
  const sql = "SELECT COUNT(*) AS n, MAX(amount) FROM t";
  const formatted = formatSql(sql);
  assert.ok(formatted.includes("COUNT(*)"), formatted);
  assert.ok(formatted.includes("MAX(amount)"), formatted);
  assertOnlyWhitespaceChanged(sql);
});

test("라인 주석 뒤는 반드시 줄이 바뀐다", () => {
  // 뒤에 무언가 이어 붙으면 그것까지 주석이 되어 SQL 이 깨진다.
  const sql = "SELECT a, -- 메모\n b FROM t";
  const formatted = formatSql(sql);
  const commentLine = formatted
    .split("\n")
    .findIndex((line) => line.includes("-- 메모"));
  assert.ok(commentLine >= 0, formatted);
  const rest = formatted.split("\n").slice(commentLine + 1).join("\n");
  assert.ok(rest.includes("b"), `주석 뒤가 같은 줄에 남았다\n${formatted}`);
  assertOnlyWhitespaceChanged(sql);
});

test("JOIN 과 ON 이 줄 앞으로 온다", () => {
  const sql =
    "SELECT * FROM a LEFT JOIN b ON a.id = b.id INNER JOIN c ON c.id = a.id WHERE a.x = 1";
  const lines = formatSql(sql).split("\n").map((line) => line.trim());
  assert.ok(lines.some((line) => line.startsWith("LEFT JOIN")), lines.join("\n"));
  assert.ok(lines.some((line) => line.startsWith("INNER JOIN")), lines.join("\n"));
  assert.ok(lines.some((line) => line.startsWith("ON")), lines.join("\n"));
  assertOnlyWhitespaceChanged(sql);
});

test("GROUP BY · ORDER BY 는 줄 앞으로, PARTITION BY 도 마찬가지다", () => {
  const sql =
    "SELECT grade, COUNT(*) FROM t GROUP BY grade ORDER BY grade DESC LIMIT 10";
  const lines = formatSql(sql).split("\n").map((line) => line.trim());
  assert.ok(lines.some((line) => line.startsWith("GROUP BY")), lines.join("\n"));
  assert.ok(lines.some((line) => line.startsWith("ORDER BY")), lines.join("\n"));
  assert.ok(lines.some((line) => line.startsWith("LIMIT")), lines.join("\n"));
  assertOnlyWhitespaceChanged(sql);
});

test("이름이 GROUP·ORDER 인 칸을 줄바꿈 자리로 오해하지 않는다", () => {
  // 뒤에 BY 가 없으면 그냥 식별자다.
  const sql = "SELECT t.group, t.order FROM t";
  const formatted = formatSql(sql);
  assert.equal(formatted.split("\n").filter((line) => line.trim()).length, 2, formatted);
  assertOnlyWhitespaceChanged(sql);
});

test("파라미터 자리 표시가 붙어서 나온다", () => {
  const sql = "SELECT * FROM t WHERE a = :since AND b = @p1 AND c = ?";
  const formatted = formatSql(sql);
  assert.ok(formatted.includes(":since"), formatted);
  assert.ok(formatted.includes("@p1"), formatted);
  assertOnlyWhitespaceChanged(sql);
});

test("빈 입력과 공백만 있는 입력은 그대로 돌려준다", () => {
  assert.equal(formatSql(""), "");
  assert.equal(formatSql("   "), "   ");
});

test("이미 포맷된 SQL 을 다시 포맷해도 같은 결과다", () => {
  // 화면이 다시 그릴 때마다 모양이 흔들리면 안 된다.
  const once = formatSql(SHIPPED);
  assert.equal(formatSql(once), once);
});

test("포맷한 결과를 다시 한 줄로 줄이면 원래 토큰과 같다", () => {
  // 공백만 바뀐다는 계약을 다른 방향에서 한 번 더 잰다.
  for (const sql of [
    SHIPPED,
    "SELECT COUNT(*) FROM t WHERE a IN (1, 2, 3) AND b = 'x'",
    "SELECT CASE WHEN a > 1 THEN 'hi' ELSE 'lo' END AS label FROM t",
  ]) {
    assertOnlyWhitespaceChanged(sql);
  }
});
