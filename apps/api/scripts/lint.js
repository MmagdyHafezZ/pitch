const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const isFix = args.includes('--fix');

const globs = ['src/**/*.ts', 'apps/**/*.ts', 'libs/**/*.ts', 'test/**/*.ts'];
const baseArgs = ['--no-error-on-unmatched-pattern'];

if (isFix) {
  baseArgs.push('--fix');
}

const env = {
  ...process.env,
  NODE_OPTIONS: process.env.NODE_OPTIONS ?? '--max-old-space-size=4096',
};

for (const glob of globs) {
  const result = spawnSync('eslint', [...baseArgs, glob], {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
