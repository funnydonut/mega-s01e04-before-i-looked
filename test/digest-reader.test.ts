import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readNight } from '../src/digest/reader.js';

const dirs: string[] = [];
function fixture(lines: unknown[] = []) {
  const dir = mkdtempSync(join(tmpdir(), 'digest-reader-'));
  dirs.push(dir);
  writeFileSync(join(dir, '2026-10-28.jsonl'), lines.map((line) => JSON.stringify(line)).join('\n'));
  return dir;
}
const event = { at: '2026-10-28T23:00:00+01:00', job: 'a', status: 'ok', owner: null };
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('readNight', () => {
  it('aggregates the real night without dropping missing owners or recovered errors', () => {
    const digest = readNight('runs', '2026-10-28');
    expect(digest?.rows.map((row) => row.job)).toEqual(['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs']);
    expect(digest?.badLines).toBe(1);
    expect(digest?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
    expect(digest?.rows[0]?.owner).toBeNull();
    expect(digest?.rows[1]).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503' });
    expect(digest?.rows[3]).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });
  it('distinguishes empty and missing nights and rejects invalid dates and traversal', () => {
    const dir = fixture();
    expect(readNight(dir, '2026-10-28')).toEqual({ night: '2026-10-28', rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
    for (const night of ['2026-10-29', '../2026-10-28', '2026-02-30', '2026-13-01', '2026-10-28/..', '']) expect(readNight(dir, night)).toBeNull();
  });
  it('counts malformed and nonconforming records while ignoring blank lines', () => {
    const invalid = [null, [], {}, { ...event, owner: 1 }, { ...event, status: 'unknown' }, { ...event, at: 'bad' }, { ...event, job: '' }, { ...event, error: 4 }];
    const dir = fixture([event, ...invalid]);
    const path = join(dir, '2026-10-28.jsonl');
    writeFileSync(path, [JSON.stringify(event), ...invalid.map((line) => JSON.stringify(line)), '{', ' ', '', ''].join('\n'));
    expect(readNight(dir, '2026-10-28')).toMatchObject({ badLines: invalid.length + 1, counts: { ok: 1, retry: 0, fail: 0 } });
  });
  it('orders events by instant while retaining their original offsets and latest error', () => {
    const dir = fixture([
      { ...event, at: '2026-10-29T00:10:00+01:00', owner: 'latest' },
      { ...event, at: '2026-10-28T23:00:00Z', status: 'retry', error: 'new error' },
      { ...event, at: '2026-10-28T23:30:00+02:00', status: 'fail', error: 'old error' },
    ]);
    expect(readNight(dir, '2026-10-28')?.rows).toEqual([{ job: 'a', owner: 'latest', runs: 3, retries: 1, failures: 1, lastStatus: 'ok', lastError: 'new error', firstAt: '2026-10-28T23:30:00+02:00', lastAt: '2026-10-29T00:10:00+01:00' }]);
  });
  it('propagates unrelated I/O errors', () => {
    const dir = fixture();
    mkdirSync(join(dir, '2026-10-29.jsonl'));
    expect(() => readNight(dir, '2026-10-29')).toThrow();
  });
});
