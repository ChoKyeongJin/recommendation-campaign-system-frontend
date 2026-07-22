"use client";

// 의존성 없는 경량 SQL 구문 강조. 키워드·문자열·주석·숫자만 색으로 구분한다(완전한 파서가 아님).
const KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "IS", "NULL", "LIKE",
  "BETWEEN", "EXISTS", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "FULL", "CROSS",
  "ON", "USING", "GROUP", "ORDER", "BY", "HAVING", "LIMIT", "OFFSET", "TOP", "AS",
  "DISTINCT", "CASE", "WHEN", "THEN", "ELSE", "END", "UNION", "ALL", "WITH",
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "CREATE", "TABLE",
  "ALTER", "DROP", "TRUNCATE", "INDEX", "VIEW", "PRIMARY", "KEY", "FOREIGN",
  "REFERENCES", "DEFAULT", "UNIQUE", "CONSTRAINT", "CHECK", "CASCADE", "ASC",
  "DESC", "COUNT", "SUM", "AVG", "MIN", "MAX", "COALESCE", "CAST", "CONVERT",
  "DATEADD", "DATEDIFF", "GETDATE", "NOW", "CURRENT_DATE", "CURRENT_TIMESTAMP",
  "INT", "INTEGER", "BIGINT", "SMALLINT", "TINYINT", "DECIMAL", "NUMERIC",
  "FLOAT", "REAL", "BIT", "BOOLEAN", "CHAR", "VARCHAR", "NVARCHAR", "TEXT",
  "DATE", "DATETIME", "DATETIME2", "TIMESTAMP", "TIME",
]);

// 순서 중요: 블록주석 → 라인주석 → 문자열 → 숫자 → 식별어 → 공백 → 기타 1글자.
const TOKEN_RE =
  /(\/\*[\s\S]*?\*\/)|(--[^\n]*)|('(?:[^']|'')*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([^\s])/g;

export function SqlHighlight({ content }: { content: string }) {
  const parts: React.ReactNode[] = [];
  let match: RegExpExecArray | null;
  let index = 0;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(content)) !== null) {
    const [, block, line, str, num, word, space, other] = match;
    const key = index++;
    if (block || line) {
      parts.push(
        <span key={key} className="text-muted-foreground italic">
          {block ?? line}
        </span>,
      );
    } else if (str) {
      parts.push(
        <span key={key} className="text-emerald-600 dark:text-emerald-400">
          {str}
        </span>,
      );
    } else if (num) {
      parts.push(
        <span key={key} className="text-purple-600 dark:text-purple-400">
          {num}
        </span>,
      );
    } else if (word) {
      if (KEYWORDS.has(word.toUpperCase())) {
        parts.push(
          <span key={key} className="font-medium text-blue-600 dark:text-blue-400">
            {word}
          </span>,
        );
      } else {
        parts.push(word);
      }
    } else {
      parts.push(space ?? other);
    }
  }

  return (
    <pre className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-card p-4 font-mono text-xs leading-relaxed text-foreground">
      {parts}
    </pre>
  );
}
