import { Injectable } from '@nestjs/common';

@Injectable()
export class AdminFeatureFlagsService {
  private readonly flags = new Map<string, boolean>();

  constructor() {
    const raw = process.env.FEATURE_FLAGS ?? '';
    if (raw) {
      for (const entry of raw.split(',')) {
        const [key, val] = entry.trim().split(':');
        if (key) {
          this.flags.set(key.trim(), val?.trim() !== 'false');
        }
      }
    }
  }

  list(): Array<{ key: string; enabled: boolean }> {
    return Array.from(this.flags.entries()).map(([key, enabled]) => ({
      key,
      enabled,
    }));
  }

  set(key: string, enabled: boolean): { key: string; enabled: boolean } {
    this.flags.set(key, enabled);
    return { key, enabled };
  }

  delete(key: string): boolean {
    return this.flags.delete(key);
  }
}
