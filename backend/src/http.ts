import type { Request, RequestHandler, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ApiError } from './errors.js';

/** Wrap async handlers so rejected promises reach the error middleware. */
export const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  ((req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));

/** Parse + validate a body/query/params object against a Zod schema. */
export function parse<T>(schema: ZodSchema<T>, data: unknown, source = 'body'): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw ApiError.unprocessable(`Invalid ${source}`, result.error.flatten());
  }
  return result.data;
}

export function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function bool(v: unknown): boolean | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (v === true || v === 'true' || v === '1' || v === 1) return true;
  return false;
}
