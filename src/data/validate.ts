/**
 * JSON データの軽量スキーマ検証。
 * 外部ライブラリを増やさず、起動時に「値が欠けている / 型が違う」を即座に検出するためのもの。
 * データ駆動設計では JSON の typo がサイレントに NaN を生むのが最も厄介なので、
 * 起動時に必ず失敗させる。
 */
export interface OptionalSchema {
  readonly __optional: Schema;
}
export interface RecordSchema {
  readonly __record: Schema;
}
export interface OneOfSchema {
  readonly __oneOf: readonly string[];
}
export type ObjectSchema = { readonly [key: string]: Schema };

export type Schema =
  | 'number'
  | 'string'
  | 'boolean'
  | OptionalSchema
  | RecordSchema
  | OneOfSchema
  | ObjectSchema
  | readonly [Schema];

/** 省略可能なキー。 */
export const optional = (schema: Schema): OptionalSchema => ({ __optional: schema });
/** 任意のキーを持つ辞書（コンボグラフなど）。 */
export const record = (schema: Schema): RecordSchema => ({ __record: schema });
/** 列挙文字列。 */
export const oneOf = (values: readonly string[]): OneOfSchema => ({ __oneOf: values });

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
    const itemSchema = (schema as readonly [Schema])[0];
    value.forEach((item, index) => validate(item, itemSchema, `${path}[${index}]`));
    return;
  }

  if ('__optional' in schema) {
    if (value === undefined) return;
    validate(value, (schema as OptionalSchema).__optional, path);
    return;
  }

  if ('__oneOf' in schema) {
    const values = (schema as OneOfSchema).__oneOf;
    if (typeof value !== 'string' || !values.includes(value)) {
      throw new DataValidationError(path, `expected one of [${values.join(', ')}], got ${String(value)}`);
    }
    return;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DataValidationError(path, `expected object, got ${describe(value)}`);
  }
  const record = value as Record<string, unknown>;

  if ('__record' in schema) {
    const valueSchema = (schema as RecordSchema).__record;
    for (const key of Object.keys(record)) {
      validate(record[key], valueSchema, `${path}.${key}`);
    }
    return;
  }

  const objectSchema = schema as ObjectSchema;
  for (const key of Object.keys(objectSchema)) {
    const sub = objectSchema[key] as Schema;
    if (!(key in record)) {
      if (typeof sub === 'object' && !Array.isArray(sub) && '__optional' in sub) continue;
      throw new DataValidationError(`${path}.${key}`, 'missing');
    }
    validate(record[key], sub, `${path}.${key}`);
  }
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}
