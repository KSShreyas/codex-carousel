import { describe, it, expect } from 'vitest';
import fs from 'fs';

describe('Scaffold cleanup and metadata reset', () => {
  const readme = fs.readFileSync('README.md', 'utf-8');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8')) as { name: string; dependencies?: Record<string, string> };

  it('README does not reference AI Studio or Gemini scaffold', () => {
    expect(readme).not.toMatch(/AI Studio/i);
    expect(readme).not.toMatch(/Gemini/i);
    expect(readme).toMatch(/manual/i);
    expect(readme).toMatch(/local/i);
  });

  it('package metadata is no longer react-example and has no @google/genai', () => {
    expect(pkg.name).toBe('codex-carousel');
    expect(pkg.dependencies?.['@google/genai']).toBeUndefined();
  });

  it('metadata.json scaffold artifact is removed', () => {
    expect(fs.existsSync('metadata.json')).toBe(false);
  });
});
