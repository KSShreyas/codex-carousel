/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class Logger {
  constructor(private logFile?: string) {}

  log(event: string, context: Record<string, any> = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      event,
      ...context,
    };
    const line = JSON.stringify(entry);
    console.log(`[CAROUSEL] ${event}`, context);
    // In a real env, we'd append to this.logFile
  }

  error(event: string, error: any, context: Record<string, any> = {}) {
    this.log(`ERROR:${event}`, {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...context,
    });
  }
}

export const logger = new Logger();
