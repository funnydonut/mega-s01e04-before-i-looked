import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestStatus, NightDigest, ReadNight } from './types.js';

type RunEvent = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error?: string;
};

function isRunEvent(value: unknown): value is RunEvent {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.at === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(record.at)
    && Number.isFinite(Date.parse(record.at))
    && typeof record.job === 'string' && record.job.trim().length > 0
    && (record.status === 'ok' || record.status === 'retry' || record.status === 'fail')
    && (record.owner === null || typeof record.owner === 'string')
    && (record.error === undefined || typeof record.error === 'string');
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  const date = new Date(`${night}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== night) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
  const digest: NightDigest = { night, rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } };
  const events: RunEvent[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      digest.badLines++;
      continue;
    }
    if (!isRunEvent(value)) {
      digest.badLines++;
      continue;
    }
    events.push(value);
  }
  events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const rows = new Map<string, NightDigest['rows'][number]>();
  for (const event of events) {
    digest.counts[event.status]++;
    let row = rows.get(event.job);
    if (!row) {
      row = { job: event.job, owner: event.owner, runs: 0, retries: 0, lastStatus: event.status, lastError: null, firstAt: event.at, lastAt: event.at };
      rows.set(event.job, row);
    }
    row.runs++;
    if (event.status === 'retry') row.retries++;
    row.owner = event.owner;
    row.lastStatus = event.status;
    row.lastAt = event.at;
    if (event.error !== undefined) row.lastError = event.error;
  }
  digest.rows = [...rows.values()].sort((a, b) => a.job < b.job ? -1 : a.job > b.job ? 1 : 0);
  return digest;
};
