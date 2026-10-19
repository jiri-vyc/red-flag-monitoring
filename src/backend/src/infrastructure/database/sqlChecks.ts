export function isOneOf(column: string, allowedValues: readonly string[]): string {
  const quotedValues = allowedValues.map(quoteSqlLiteral).join(", ");

  return `"${column}" IN (${quotedValues})`;
}

export function isBetween(column: string, min: number, max: number): string {
  return `"${column}" BETWEEN ${min} AND ${max}`;
}

export function isSubsetOf(arrayColumn: string, allowedValues: readonly string[]): string {
  const quotedValues = allowedValues.map(quoteSqlLiteral).join(", ");

  return `"${arrayColumn}" <@ ARRAY[${quotedValues}]::text[]`;
}

function quoteSqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
