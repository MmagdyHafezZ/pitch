#!/usr/bin/env node

require('dotenv').config();
const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL;
const KEY_PATTERN = 'sim:session:*:full';
const SCAN_BATCH_SIZE = 500;

async function deleteKeysByPattern(redis, pattern) {
  let cursor = '0';
  let totalDeleted = 0;

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      SCAN_BATCH_SIZE,
    );

    cursor = nextCursor;

    if (keys.length > 0) {
      totalDeleted += await redis.del(...keys);
    }
  } while (cursor !== '0');

  return totalDeleted;
}

async function main() {
  if (!REDIS_URL) {
    throw new Error('REDIS_URL is not set');
  }

  const redis = new Redis(REDIS_URL);

  try {
    const deleted = await deleteKeysByPattern(redis, KEY_PATTERN);
    console.log(
      `Deleted ${deleted} Redis keys matching pattern "${KEY_PATTERN}".`,
    );
  } finally {
    await redis.quit();
  }
}

main().catch((error) => {
  console.error(
    `Failed to purge session-full cache keys: ${error?.message ?? error}`,
  );
  process.exit(1);
});
