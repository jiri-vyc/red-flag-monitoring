export function isOneOf(column: string, allowedValues: readonly string[]): string {
  const quotedValues = allowedValues.map(quoteSqlLiteral).join(", ");

  return `"${column}" IN (${quotedValues})`;
}

function quoteSqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
