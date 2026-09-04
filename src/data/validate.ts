/**
 * JSON データの軽量スキーマ検証。
 * 外部ライブラリを増やさず、起動時に「値が欠けている / 型が違う」を即座に検出するためのもの。
 * データ駆動設計では JSON の typo がサイレントに NaN を生むのが最も厄介なので、
 * 起動時に必ず失敗させる。
 */
export type Schema =
  | 'number'
  | 'string'
  | 'boolean'
  | { readonly [key: string]: Schema }
  | readonly [Schema];

export class DataValidationError extends Error {
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(`[data] ${path}: ${message}`);
    this.name = 'DataValidationError';
  }
}

export function validate(value: unknown, schema: Schema, path = 'root'): void {
  if (typeof schema === 'string') {
    if (typeof value !== schema) {
      throw new DataValidationError(path, `expected ${schema}, got ${describe(value)}`);
    }
    if (schema === 'number' && !Number.isFinite(value as number)) {
      throw new DataValidationError(path, `expected finite number, got ${String(value)}`);
    }
    return;
  }

  if (Array.isArray(schema)) {
    if (!Array.isArray(value)) {
      throw new DataValidationError(path, `expected array, got ${describe(value)}`);
    }
    const itemSchema = schema[0];
    value.forEach((item, index) => validate(item, itemSchema, `${path}[${index}]`));
    return;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DataValidationError(path, `expected object, got ${describe(value)}`);
  }
  const record = value as Record<string, unknown>;
  const objectSchema = schema as { readonly [key: string]: Schema };
  for (const key of Object.keys(objectSchema)) {
    if (!(key in record)) {
      throw new DataValidationError(`${path}.${key}`, 'missing');
    }
    validate(record[key], objectSchema[key] as Schema, `${path}.${key}`);
  }
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}
