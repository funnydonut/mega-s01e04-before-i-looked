import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const tempDirs: string[] = [];

function runsDir() {
  const dir = mkdtempSync(join(tmpdir(), 'digest-board-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('digest status board', () => {
  it('links every night to its digest and shows event counts from the run log', async () => {
    const dir = runsDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '2026-10-28.jsonl'), [
      JSON.stringify({ at: '2026-10-28T01:00:00+01:00', job: 'backup', status: 'ok', owner: 'rook' }),
      JSON.stringify({ at: '2026-10-28T01:01:00+01:00', job: 'deploy', status: 'retry', owner: 'rook' }),
      JSON.stringify({ at: '2026-10-28T01:02:00+01:00', job: 'deploy', status: 'fail', owner: 'rook' }),
    ].join('\n'));
    writeFileSync(join(dir, '2026-10-27.jsonl'), '');

    const res = await createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir }).request('/');
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain('<a href="/digest/2026-10-28">2026-10-28</a>');
    expect(html).toContain('<a href="/digest/2026-10-27">2026-10-27</a>');
    expect(html).toContain('ok 1 · retry 1 · fail 1');
    expect(html).toContain('ok 0 · retry 0 · fail 0');
  });
});
