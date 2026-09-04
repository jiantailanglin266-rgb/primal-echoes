import { describe, expect, it } from 'vitest';
import { DataValidationError, validate } from '@data/validate';
import { loadBalance, loadDevTerrain } from '@data/DataRegistry';

describe('validate', () => {
  it('accepts a matching object', () => {
    expect(() => validate({ a: 1, b: { c: 'x' }, d: [true] }, { a: 'number', b: { c: 'string' }, d: ['boolean'] })).not.toThrow();
  });

  it('reports the path of a missing key', () => {
    expect(() => validate({ a: {} }, { a: { b: 'number' } })).toThrowError(/root\.a\.b: missing/);
  });

  it('rejects wrong types and non-finite numbers', () => {
    expect(() => validate({ a: '1' }, { a: 'number' })).toThrow(DataValidationError);
    expect(() => validate({ a: Number.NaN }, { a: 'number' })).toThrow(DataValidationError);
  });

  it('validates array items with index in path', () => {
    expect(() => validate({ xs: [1, 'two'] }, { xs: ['number'] })).toThrowError(/xs\[1\]/);
  });
});

describe('DataRegistry', () => {
  it('loads and validates balance.json', () => {
    const balance = loadBalance();
    expect(balance.player.maxHp).toBeGreaterThan(0);
    expect(balance.player.dodge.invulnEndSeconds).toBeGreaterThan(balance.player.dodge.invulnStartSeconds);
    expect(balance.player.dodge.invulnEndSeconds).toBeLessThanOrEqual(balance.player.dodge.durationSeconds);
  });

  it('loads and validates dev terrain', () => {
    const terrain = loadDevTerrain();
    expect(terrain.hills.length).toBeGreaterThan(0);
  });
});
