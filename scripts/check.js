const { spawnSync } = require('child_process')

const checks = [
  { id: 'format', label: 'Format', cmd: 'pnpm', args: ['run', 'format'] },
  { id: 'lint', label: 'Lint', cmd: 'pnpm', args: ['run', 'lint'] },
  { id: 'type-check', label: 'Type Check', cmd: 'pnpm', args: ['run', 'type-check'] },
  { id: 'test', label: 'Tests', cmd: 'pnpm', args: ['run', 'test'] },
  { id: 'build', label: 'Build', cmd: 'pnpm', args: ['run', 'build'] },
]

const results = []

for (const check of checks) {
  console.log(`\n==> ${check.label} (${check.id})`)
  const start = Date.now()
  const result = spawnSync(check.cmd, check.args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  const durationMs = Date.now() - start
  const status = typeof result.status === 'number' ? result.status : 1
  const ok = status === 0

  if (result.error) {
    console.error(`Failed to run ${check.id}: ${result.error.message}`)
  }

  results.push({
    ...check,
    ok,
    status,
    durationMs,
  })
}

const labelWidth = Math.max(...results.map((item) => item.label.length), 6)
const toSeconds = (ms) => `${(ms / 1000).toFixed(1)}s`

console.log('\nSummary')
for (const result of results) {
  const status = result.ok ? 'PASS' : 'FAIL'
  console.log(
    `${status.padEnd(5)} ${result.label.padEnd(labelWidth)} ${toSeconds(result.durationMs)}`
  )
}

const failed = results.filter((result) => !result.ok)
if (failed.length > 0) {
  console.log(`\nChecks failed: ${failed.map((result) => result.id).join(', ')}`)
  process.exit(1)
}

console.log('\nAll checks passed.')
