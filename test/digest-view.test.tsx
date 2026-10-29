import { describe, expect, it } from 'vitest';
import { renderToString } from 'hono/jsx/dom/server';
import { DigestPage } from '../src/views/digest.js';
import type { NightDigest } from '../src/digest/types.js';

describe('digest page', () => {
  it('shows sorted rows, preserved times, missing values, and highlights retries and failures', () => {
    const digest: NightDigest = {
      night: '2026-10-28',
      badLines: 2,
      counts: { ok: 0, retry: 0, fail: 0 },
      rows: [
        { job: 'alpha', owner: null, runs: 4, retries: 3, lastStatus: 'retry', lastError: null, firstAt: '2026-10-28T08:00:00+02:00', lastAt: '2026-10-28T08:03:00+02:00' },
        { job: 'beta', owner: 'Sam', runs: 1, retries: 0, lastStatus: 'fail', lastError: 'broken', firstAt: '2026-10-28T08:04:00+02:00', lastAt: '2026-10-28T08:04:00+02:00' },
        { job: 'gamma', owner: 'Rae', runs: 3, retries: 2, lastStatus: 'ok', lastError: null, firstAt: '2026-10-28T06:00:00Z', lastAt: '2026-10-28T06:02:00Z' },
      ],
    };
    const html = renderToString(<DigestPage digest={digest} />);
    expect(html.indexOf('alpha')).toBeLessThan(html.indexOf('beta'));
    expect(html.indexOf('beta')).toBeLessThan(html.indexOf('gamma'));
    expect(html).toContain('class="warn"');
    expect(html).toContain('3');
    expect(html).toContain('—');
    expect(html).toContain('2026-10-28T08:00:00+02:00');
    expect(html).toContain('2 bad lines');
    expect(html).toContain('href="/"');
  });

  it('escapes external strings rendered in the table', () => {
    const digest: NightDigest = {
      night: '2026-10-28', badLines: 0, counts: { ok: 0, retry: 0, fail: 0 },
      rows: [{ job: '<img src=x>', owner: '<script>alert(1)</script>', runs: 1, retries: 0, lastStatus: 'ok', lastError: '<b>oops</b>', firstAt: '2026-10-28T08:00:00Z', lastAt: '2026-10-28T08:00:00Z' }],
    };
    const html = renderToString(<DigestPage digest={digest} />);
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;b&gt;oops&lt;/b&gt;');
    expect(html).not.toContain('<script>');
  });

  it('shows an empty-state message when nothing ran', () => {
    const digest: NightDigest = { night: '2026-10-28', rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } };
    const html = renderToString(<DigestPage digest={digest} />);
    expect(html).toContain('nothing ran');
  });
});
