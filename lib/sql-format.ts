/**
 * 출고된 SQL 을 읽기 좋게 줄바꿈한다 — **공백만 바꾼다.**
 *
 * **왜 공백만인가.** 화면에 뜨는 SQL 은 백엔드가 만들어 실제로 실행한(또는 실행 직전에 막힌)
 * 문자열이다. 보기 좋으라고 토큰을 지우거나 순서를 바꾸면, 화면이 실행된 것과 다른 것을 보여
 * 주게 된다. 그래서 이 모듈은 토큰을 하나도 더하거나 빼지 않고 **사이의 공백만** 다시 쓴다.
 * `tokenSignature` 가 그 불변을 재고, 테스트가 입력과 출력의 서명이 같은지 본다.
 *
 * 문자열 리터럴·주석 안쪽은 토큰 하나로 통째로 들고 다니므로 건드리지 않는다. 그 안의 공백이
 * 바뀌면 그것은 값이 바뀌는 것이다.
 *
 * 완전한 SQL 파서가 아니다. 방언별 문법을 다 알지 못하며, 모르는 것은 **그대로 한 줄로 둔다** —
 * 잘못 끊는 것보다 안 끊는 편이 낫다.
 */

type TokenType = "comment" | "string" | "word" | "number" | "operator" | "punct";

type Token = { readonly type: TokenType; readonly text: string };

// 순서 중요: 블록주석 → 라인주석 → 작은따옴표 문자열 → 따옴표 식별자 → 공백 →
// 여러 글자 연산자 → 낱말(한글 식별자 포함) → 숫자 → 나머지 한 글자.
const TOKEN_RE =
  /(\/\*[\s\S]*?\*\/)|(--[^\n]*)|('(?:[^']|'')*')|("(?:[^"]|"")*"|`[^`]*`|\[[^\]]*\])|(\s+)|(<=|>=|<>|!=|\|\||::)|([A-Za-z_À-￿][\wÀ-￿$]*)|(\d+(?:\.\d+)?)|([^\s])/g;

/** 앞에서 줄을 바꾸는 낱말. */
const BREAK_BEFORE = new Set([
  "SELECT", "FROM", "WHERE", "HAVING", "LIMIT", "OFFSET", "UNION", "INTERSECT",
  "EXCEPT", "JOIN", "ON", "VALUES", "SET", "RETURNING",
]);

/** 뒤에 `BY` 가 올 때만 줄을 바꾸는 낱말. */
const BREAK_BEFORE_WITH_BY = new Set(["GROUP", "ORDER", "PARTITION"]);

/** 뒤에 `JOIN`/`OUTER` 가 올 때만 줄을 바꾸는 낱말. */
const JOIN_LEAD = new Set(["LEFT", "RIGHT", "INNER", "OUTER", "FULL", "CROSS"]);

/** 줄을 바꾸고 한 칸 더 들여쓰는 이음말. */
const CONNECTORS = new Set(["AND", "OR"]);

/** 괄호 안에 이것이 있으면 그 괄호를 펼친다. 없으면 한 줄로 둔다(`COUNT(*)`). */
const EXPANDS_GROUP = new Set(["SELECT", "WHERE", "AND", "OR", "FROM", "UNION", "CASE"]);

/** 이 길이를 넘긴 줄은 쉼표 뒤에서 한 번 더 끊는다. */
const COMMA_WRAP_AT = 72;

const INDENT = "  ";

function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_RE.exec(sql)) !== null) {
    const [, block, line, text, quoted, space, operator, word, number, other] = match;
    if (space !== undefined) continue; // 공백은 우리가 다시 쓴다
    if (block !== undefined) tokens.push({ type: "comment", text: block });
    else if (line !== undefined) tokens.push({ type: "comment", text: line });
    else if (text !== undefined) tokens.push({ type: "string", text });
    else if (quoted !== undefined) tokens.push({ type: "string", text: quoted });
    else if (operator !== undefined) tokens.push({ type: "operator", text: operator });
    else if (word !== undefined) tokens.push({ type: "word", text: word });
    else if (number !== undefined) tokens.push({ type: "number", text: number });
    else if (other !== undefined) tokens.push({ type: "punct", text: other });
  }
  return tokens;
}

/**
 * 공백을 뺀 토큰 열 — 포맷 전후가 같아야 한다.
 *
 * 이 값이 달라졌다면 공백이 아니라 SQL 자체가 바뀐 것이다.
 */
export function tokenSignature(sql: string): string {
  return tokenize(sql)
    .map((token) => `${token.type}:${token.text}`)
    .join("\u0000");
}

/** 그 여는 괄호의 짝을 찾는다. 못 찾으면 -1. */
function matchingParen(tokens: readonly Token[], open: number): number {
  let depth = 0;
  for (let index = open; index < tokens.length; index += 1) {
    const text = tokens[index].text;
    if (tokens[index].type === "punct" && text === "(") depth += 1;
    else if (tokens[index].type === "punct" && text === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/** 이 괄호 안에 줄을 나눌 만한 것이 있는가. */
function groupExpands(tokens: readonly Token[], open: number, close: number): boolean {
  for (let index = open + 1; index < close; index += 1) {
    const token = tokens[index];
    if (token.type === "word" && EXPANDS_GROUP.has(token.text.toUpperCase())) {
      return true;
    }
  }
  return false;
}

function nextWord(tokens: readonly Token[], index: number): string | null {
  const token = tokens[index + 1];
  return token && token.type === "word" ? token.text.toUpperCase() : null;
}

function previousWord(tokens: readonly Token[], index: number): string | null {
  const token = tokens[index - 1];
  return token && token.type === "word" ? token.text.toUpperCase() : null;
}

/** 두 토큰 사이에 공백을 둘 것인가. */
function needsSpace(previous: Token, token: Token): boolean {
  if (previous.text === "(" || token.text === ")") return false;
  if (token.text === "," || token.text === ";") return false;
  if (previous.text === "." || token.text === ".") return false;
  if (previous.text === ":" || previous.text === "@") return false; // :성별 · @p1
  if (token.text === "(") {
    // COUNT(*) 는 붙이고, IN (…) · EXISTS (…) 는 띄운다.
    return previous.type !== "word" || isBareKeyword(previous.text);
  }
  return true;
}

const SPACED_BEFORE_PAREN = new Set([
  "IN", "EXISTS", "NOT", "AND", "OR", "VALUES", "ON", "WHERE", "SELECT", "FROM",
  "BETWEEN", "ALL", "ANY", "SOME", "UNION", "RETURNING", "USING",
]);

function isBareKeyword(text: string): boolean {
  return SPACED_BEFORE_PAREN.has(text.toUpperCase());
}

/**
 * SQL 을 줄바꿈해 돌려준다. 공백만 바뀐다.
 *
 * 빈 문자열이나 토큰이 없는 입력은 그대로 돌려준다.
 */
export function formatSql(sql: string): string {
  if (typeof sql !== "string" || !sql.trim()) return sql;

  const tokens = tokenize(sql);
  if (tokens.length === 0) return sql;

  // 각 여는 괄호가 펼쳐지는지 미리 정해 둔다.
  const expanded = new Map<number, number>(); // 여는 괄호 index → 닫는 괄호 index
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].type === "punct" && tokens[index].text === "(") {
      const close = matchingParen(tokens, index);
      if (close > index && groupExpands(tokens, index, close)) {
        expanded.set(index, close);
      }
    }
  }
  const closesExpanded = new Set(expanded.values());

  let out = "";
  let line = "";
  /**
   * 펼친 괄호마다 그 안의 들여쓰기와 닫는 괄호가 설 자리.
   *
   * 깊이 × 두 칸으로 계산하지 않는다 — 괄호가 `AND (` 처럼 이미 들여쓴 줄에서 열리면 그 줄을
   * 기준으로 삼아야 닫는 괄호가 연 자리와 세로로 맞는다.
   */
  const frames: { content: string; close: string }[] = [{ content: "", close: "" }];
  const base = () => frames[frames.length - 1].content;
  /** 깊이별로 BETWEEN 의 AND 를 기다리는 중인가 — 그 AND 는 줄을 바꾸지 않는다. */
  const betweenPending: boolean[] = [];
  const leadingSpaces = (text: string) => text.slice(0, text.length - text.trimStart().length);

  const flush = () => {
    if (line.length > 0) {
      out += (out.length > 0 ? "\n" : "") + line;
      line = "";
    }
  };
  const startLine = (indent: string) => {
    flush();
    line = indent;
  };
  const append = (text: string, previous: Token | null, token: Token) => {
    if (line.trim().length === 0) {
      line += text;
      return;
    }
    line += (previous && needsSpace(previous, token) ? " " : "") + text;
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const previous = index > 0 ? tokens[index - 1] : null;
    const upper = token.type === "word" ? token.text.toUpperCase() : "";

    const depth = frames.length - 1;

    if (token.type === "punct" && token.text === ")") {
      if (closesExpanded.has(index) && frames.length > 1) {
        const frame = frames.pop()!;
        betweenPending[depth] = false;
        startLine(frame.close);
        line += ")";
        continue;
      }
      append(")", previous, token);
      continue;
    }

    if (token.type === "word") {
      if (upper === "BETWEEN") betweenPending[depth] = true;

      const isConnector = CONNECTORS.has(upper);
      if (isConnector && betweenPending[depth]) {
        // BETWEEN a AND b 의 AND 는 이음말이 아니다.
        betweenPending[depth] = false;
      } else if (isConnector) {
        startLine(base() + INDENT);
        line += token.text;
        continue;
      } else if (
        // `LEFT JOIN` 은 한 덩어리다 — 수식어가 줄을 열었으면 JOIN 은 뒤따라 붙는다.
        (BREAK_BEFORE.has(upper) &&
          !(upper === "JOIN" && JOIN_LEAD.has(previousWord(tokens, index) ?? ""))) ||
        (BREAK_BEFORE_WITH_BY.has(upper) && nextWord(tokens, index) === "BY") ||
        (JOIN_LEAD.has(upper) &&
          (nextWord(tokens, index) === "JOIN" || nextWord(tokens, index) === "OUTER"))
      ) {
        // 줄 맨 앞이면 이미 새 줄이다.
        if (line.trim().length > 0) startLine(base());
        else line = base();
        line += token.text;
        continue;
      }
    }

    append(token.text, previous, token);

    if (token.type === "comment" && token.text.startsWith("--")) {
      // 라인 주석 뒤에 무언가 이어 붙으면 그것까지 주석이 된다.
      flush();
      continue;
    }

    if (token.type === "punct" && token.text === "(" && expanded.has(index)) {
      const opened = leadingSpaces(line);
      frames.push({ content: opened + INDENT, close: opened });
      betweenPending[frames.length - 1] = false;
      startLine(opened + INDENT);
      continue;
    }

    if (token.type === "punct" && token.text === "," && line.length > COMMA_WRAP_AT) {
      startLine(base() + INDENT);
    }
  }

  flush();
  return out;
}
