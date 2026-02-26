// Lint script for analytics microservice.
// Uses tsc for type checking since eslint is not yet configured for this app.
const { spawnSync } = require('child_process')

const result = spawnSync('tsc', ['--noEmit'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

process.exit(result.status ?? 0)
