/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';

export interface LogEntry {
  timestamp: string;
  event: string;
  [key: string]: any;
}

function sanitizeValue(key: string, value: any): any {
  const k = key.toLowerCase();
  if (typeof value === 'string' && (k.includes('token') || k.includes('password') || k.includes('secret'))) {
    return '[REDACTED]';
  }
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeValue(key, v));
  }
  if (value && typeof value === 'object') {
    const next: Record<string, any> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      next[childKey] = sanitizeValue(childKey, childValue);
    }
    return next;
  }
  return value;
}

function sanitizeContext(context: Record<string, any>) {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(context)) {
    clean[key] = sanitizeValue(key, value);
  }
  return clean;
}

export class Logger {
  private logFile: string | null = null;
  private buffer: LogEntry[] = [];

  constructor(logDir?: string) {
    if (logDir) {
      this.logFile = path.join(logDir, 'carousel.jsonl');
    }
  }

  async init() {
    if (this.logFile) {
      const dir = path.dirname(this.logFile);
      await fs.mkdir(dir, { recursive: true });
    }
  }

  setLogFile(filePath: string) {
    this.logFile = filePath;
  }

  log(event: string, context: Record<string, any> = {}) {
    const safeContext = sanitizeContext(context);
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      event,
      ...safeContext,
    };
    const line = JSON.stringify(entry);
    console.log(`[CAROUSEL] ${event}`, safeContext);

    this.buffer.push(entry);
    if (this.buffer.length > 500) {
      this.buffer.shift();
    }

    if (this.logFile) {
      fs.appendFile(this.logFile, line + '\n').catch(() => {});
    }
  }

  error(event: string, error: any, context: Record<string, any> = {}) {
    this.log(`ERROR:${event}`, {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...context,
    });
  }

  getRecentEvents(limit: number = 100): LogEntry[] {
    return this.buffer.slice(-limit).reverse();
  }

  async loadRecentEvents(limit: number = 100): Promise<LogEntry[]> {
    if (!this.logFile) {
      return this.getRecentEvents(limit);
    }
    try {
      const content = await fs.readFile(this.logFile, 'utf-8');
      const lines = content.trim().split('\n').filter((l) => l);
      const entries = lines.map((l) => JSON.parse(l) as LogEntry);
      return entries.slice(-limit).reverse();
    } catch {
      return this.getRecentEvents(limit);
    }
  }
}

export const logger = new Logger();
