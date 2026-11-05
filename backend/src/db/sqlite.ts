import { DatabaseSync, type StatementSync, type StatementResultingChanges } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { SCHEMA_SQL } from './schema.js';
import { seedDatabase } from './seed.js';

export type Row = Record<string, unknown>;

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
  _db = new DatabaseSync(config.dbFile);
  _db.exec('PRAGMA journal_mode = WAL;');
  _db.exec('PRAGMA foreign_keys = ON;');
  _db.exec(SCHEMA_SQL);
  seedDatabase(_db);
  return _db;
}

/** Synchronous init for modules that import at top-level. */
export function initDb(): DatabaseSync {
  return getDb();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function uuid(): string {
  // crypto.randomUUID
  return globalThis.crypto.randomUUID();
}

export function run(sql: string, ...params: unknown[]): StatementResultingChanges {
  return getDb().prepare(sql).run(...(params as never[]));
}

export function all<T = Row>(sql: string, ...params: unknown[]): T[] {
  return getDb().prepare(sql).all(...(params as never[])) as T[];
}

export function get<T = Row>(sql: string, ...params: unknown[]): T | undefined {
  return getDb().prepare(sql).get(...(params as never[])) as T | undefined;
}

export function exec(sql: string): void {
  getDb().exec(sql);
}

/** Convert a SQLite row's 0/1 booleans and ISO timestamps into friendly JSON. */
export function rowToJson(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === 'number' && (v === 0 || v === 1)) {
      // leave numbers; callers decide. booleans are represented as 0/1 ints.
      out[k] = v;
    } else {
      out[k] = v;
    }
  }
  return out;
}
