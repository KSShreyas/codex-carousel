/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';

export class Storage {
  constructor(private baseDir: string) {}

  async ensureDir(dirName?: string) {
    const target = dirName ? path.join(this.baseDir, dirName) : this.baseDir;
    await fs.mkdir(target, { recursive: true });
  }

  async saveJson<T>(fileName: string, data: T) {
    const filePath = path.join(this.baseDir, fileName);
    await this.ensureDir(path.dirname(fileName));
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tempPath, filePath);
  }

  async loadJson<T>(fileName: string): Promise<T | null> {
    const filePath = path.join(this.baseDir, fileName);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      return null;
    }
  }

  async listFiles(dirName: string): Promise<string[]> {
    const target = path.join(this.baseDir, dirName);
    try {
      const entries = await fs.readdir(target, { withFileTypes: true });
      return entries.filter(e => e.isFile()).map(e => e.name);
    } catch {
      return [];
    }
  }

  async deleteFile(fileName: string) {
    const filePath = path.join(this.baseDir, fileName);
    try {
      await fs.unlink(filePath);
    } catch {}
  }
}
