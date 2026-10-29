import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';

const dirs: string[] = [];
const night = '2026-10-28';

function runsDir(files: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'digest-routes-'));
  dirs.push(dir);
  for (const [name, contents] of Object.entries(files)) writeFileSync(join(dir, name), contents);
  return dir;
}

function appFor(dir: string) {
  return createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });
}

afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('digest routes', () => {
  it('serves equivalent ordered jobs in HTML and JSON, with safe values and warning states', async () => {
    const events = [
      { at: '2026-10-28T08:00:00+02:00', job: '<img src=x>', status: 'ok', owner: null },
      { at: '2026-10-28T08:01:00+02:00', job: 'zeta', status: 'retry', owner: 'Ada', error: '<script>alert(1)</script>' },
      { at: '2026-10-28T08:02:00+02:00', job: 'zeta', status: 'retry', owner: 'Ada' },
      { at: '2026-10-28T08:03:00+02:00', job: 'zeta', status: 'retry', owner: 'Ada' },
      { at: '2026-10-28T08:04:00+02:00', job: 'zeta', status: 'retry', owner: 'Ada' },
      { at: '2026-10-28T08:05:00+02:00', job: 'failed', status: 'fail', owner: 'Sam' },
    ];
    const app = appFor(runsDir({ [`${night}.jsonl`]: events.map((event) => JSON.stringify(event)).join('\n') }));
    const [page, api] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);

    expect(page.status).toBe(200);
    expect(api.status).toBe(200);
    expect(api.headers.get('content-type')).toContain('application/json');
    const digest = await api.json();
    const html = await page.text();
    const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
    const htmlJobs = [...body.matchAll(/<tr>\s*<td>(.*?)<\/td>/g)].map((match) => match[1].replaceAll('&lt;', '<').replaceAll('&gt;', '>'));
    expect(digest.rows.map((row: { job: string }) => row.job)).toEqual(['<img src=x>', 'failed', 'zeta']);
    expect(htmlJobs).toEqual(['<img src=x>', 'failed', 'zeta']);
    expect(digest.rows.map((row: { job: string }) => row.job)).toEqual(htmlJobs);
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('—');
    expect(html).toContain('2026-10-28T08:00:00+02:00');
    expect(html).toContain('class="warn">4</td>');
    expect(html).toContain('class="warn">fail</td>');
  });

  it('returns 404 for missing and invalid nights on both routes', async () => {
    const app = appFor(runsDir());
    for (const path of [`/digest/${night}`, `/api/digest/${night}`, '/digest/2026-02-30', '/api/digest/2026-02-30']) {
      expect((await app.request(path)).status).toBe(404);
    }
  });

  it('renders an empty night and keeps a malformed line visible in both routes', async () => {
    const emptyApp = appFor(runsDir({ [`${night}.jsonl`]: '' }));
    const [emptyPage, emptyApi] = await Promise.all([
      emptyApp.request(`/digest/${night}`), emptyApp.request(`/api/digest/${night}`),
    ]);
    expect(emptyPage.status).toBe(200);
    expect(await emptyPage.text()).toContain('nothing ran');
    expect(emptyApi.status).toBe(200);
    expect(emptyApi.headers.get('content-type')).toContain('application/json');
    expect(await emptyApi.json()).toMatchObject({ rows: [], badLines: 0 });

    const malformedApp = appFor(runsDir({ [`${night}.jsonl`]: '{not json\n' }));
    const [malformedPage, malformedApi] = await Promise.all([
      malformedApp.request(`/digest/${night}`), malformedApp.request(`/api/digest/${night}`),
    ]);
    expect(malformedPage.status).toBe(200);
    expect(await malformedPage.text()).toContain('1 bad lines');
    expect(malformedApi.status).toBe(200);
    expect(await malformedApi.json()).toMatchObject({ rows: [], badLines: 1 });
  });
});
