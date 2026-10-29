import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';

const dirs: string[] = [];
function fixture(text: string) {
  const dir = mkdtempSync(join(tmpdir(), 'digest-api-'));
  dirs.push(dir);
  writeFileSync(join(dir, '2026-10-28.jsonl'), text);
  return dir;
}
function appFor(runsDir: string) {
  return createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('digest JSON route', () => {
  it('returns the aggregated digest with rows sorted by job', async () => {
    const events = [
      { at: '2026-10-28T23:01:00+01:00', job: 'zeta', status: 'ok', owner: null },
      { at: '2026-10-28T23:00:00+01:00', job: 'alpha', status: 'retry', owner: 'Ada', error: 'temporary' },
    ];
    const res = await appFor(fixture(events.map((event) => JSON.stringify(event)).join('\n'))).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ night: '2026-10-28', badLines: 0, counts: { ok: 1, retry: 1, fail: 0 }, rows: [{ job: 'alpha' }, { job: 'zeta' }] });
  });

  it('returns 404 when the night is missing or the path is invalid', async () => {
    const missingDir = mkdtempSync(join(tmpdir(), 'digest-api-'));
    dirs.push(missingDir);
    const app = appFor(missingDir);
    const missing = await app.request('/api/digest/2026-10-29');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'digest not found' });
    expect((await app.request('/api/digest/2026-10-28%2F..')).status).toBe(404);
  });

  it('returns an empty digest and counts malformed lines', async () => {
    const empty = await appFor(fixture('')).request('/api/digest/2026-10-28');
    expect(await empty.json()).toEqual({ night: '2026-10-28', rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
    const malformed = await appFor(fixture('{\n')).request('/api/digest/2026-10-28');
    expect(malformed.status).toBe(200);
    expect((await malformed.json()).badLines).toBe(1);
  });
});
