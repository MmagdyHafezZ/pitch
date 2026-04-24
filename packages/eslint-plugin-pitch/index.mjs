import fs from 'node:fs'
import path from 'node:path'

const TEST_FILE_SUFFIXES = ['.spec.ts', '.spec.tsx', '.test.ts', '.test.tsx']
const TEST_DIRECTORIES = ['__tests__', '__test__', 'tests']
const DEFAULT_IGNORES = [
  '**/*.d.ts',
  '**/*.dto.ts',
  '**/*.enum.ts',
  '**/*.constants.ts',
  '**/*.config.ts',
  '**/*.module.ts',
  '**/*.interface.ts',
  '**/*.schema.ts',
  '**/*.type.ts',
  '**/*.types.ts',
  '**/*.fixture.ts',
  '**/*.fixtures.ts',
  '**/*.factory.ts',
  '**/*.mocks.ts',
  '**/*.mock.ts',
  '**/*.stories.tsx',
  '**/__generated__/**',
  '**/__mocks__/**',
  '**/__fixtures__/**',
]

const DEFAULT_OPTIONS = {
  requireEnv: 'PITCH_ENFORCE_TESTS',
  envValue: 'true',
  ignore: [],
  includeDefaults: true,
}

const SPECIAL_REGEX_CHARS = new Set([
  '.',
  '*',
  '+',
  '?',
  '^',
  '$',
  '{',
  '}',
  '(',
  ')',
  '|',
  '[',
  ']',
  '\\',
])
const ALLOWLIST_FILE = 'tests.allowlist.json'
const allowlistCache = new Map()
const packageNameCache = new Map()

function normalizePath(targetPath) {
  return targetPath.replace(/\\/gu, '/')
}

function shouldEnforce(options) {
  if (!options.requireEnv) {
    return true
  }

  const current = process.env[options.requireEnv]
  return current === (options.envValue ?? 'true')
}

function buildIgnoreList(options, cwd) {
  const userIgnores = Array.isArray(options.ignore) ? options.ignore : []
  const patterns =
    options.includeDefaults === false ? userIgnores : [...DEFAULT_IGNORES, ...userIgnores]
  const allowlist = loadAllowlist(cwd)
  return [...patterns.map(normalizePath), ...allowlist]
}

function segmentToRegExp(segment) {
  let pattern = ''

  for (const char of segment) {
    if (char === '*') {
      pattern += '[^/]*'
      continue
    }

    if (char === '?') {
      pattern += '.'
      continue
    }

    pattern += escapeRegexChar(char)
  }

  return new RegExp(`^${pattern}$`, 'u')
}

function escapeRegexChar(char) {
  return SPECIAL_REGEX_CHARS.has(char) ? `\\${char}` : char
}

function matchSegments(patternSegments, candidateSegments) {
  if (patternSegments.length === 0) {
    return candidateSegments.length === 0
  }

  const [currentPattern, ...restPattern] = patternSegments

  if (currentPattern === '**') {
    if (matchSegments(restPattern, candidateSegments)) {
      return true
    }

    if (candidateSegments.length === 0) {
      return false
    }

    return matchSegments(patternSegments, candidateSegments.slice(1))
  }

  if (candidateSegments.length === 0) {
    return false
  }

  const [currentCandidate, ...restCandidate] = candidateSegments
  return segmentToRegExp(currentPattern).test(currentCandidate)
    ? matchSegments(restPattern, restCandidate)
    : false
}

function matchesGlob(pattern, candidate) {
  const patternSegments = normalizePath(pattern).split('/')
  const candidateSegments = normalizePath(candidate).split('/')
  return matchSegments(patternSegments, candidateSegments)
}

function isIgnored(relativePath, ignorePatterns) {
  return ignorePatterns.some((pattern) => matchesGlob(pattern, normalizePath(relativePath)))
}

function loadAllowlist(cwd) {
  const cacheKey = normalizePath(cwd)
  if (allowlistCache.has(cacheKey)) {
    return allowlistCache.get(cacheKey)
  }

  const candidate = findAllowlistFile(cwd)
  if (!candidate) {
    allowlistCache.set(cacheKey, [])
    return []
  }

  try {
    const raw = fs.readFileSync(candidate, 'utf8')
    const data = JSON.parse(raw)
    const repoRoot = path.dirname(candidate)
    const workspaceKey = normalizePath(path.relative(repoRoot, cwd)) || '.'
    const workspaceName = readPackageName(cwd) ?? null
    const allowPatterns = extractAllowPatterns(data, workspaceKey, workspaceName)
    const normalized = allowPatterns.map(normalizePath)
    allowlistCache.set(cacheKey, normalized)
    return normalized
  } catch (error) {
    allowlistCache.set(cacheKey, [])
    return []
  }
}

function findAllowlistFile(startDir) {
  let current = startDir
  while (current && current !== path.dirname(current)) {
    const candidate = path.join(current, ALLOWLIST_FILE)
    if (fs.existsSync(candidate)) {
      return candidate
    }
    const parent = path.dirname(current)
    if (parent === current) {
      break
    }
    current = parent
  }
  return null
}

function extractAllowPatterns(data, workspaceKey, workspaceName) {
  if (Array.isArray(data)) {
    return data
  }

  if (!data || typeof data !== 'object') {
    return []
  }

  const patterns = []

  if (Array.isArray(data.global)) {
    patterns.push(...data.global)
  }

  if (Array.isArray(data[workspaceKey])) {
    patterns.push(...data[workspaceKey])
  }

  if (workspaceName && Array.isArray(data[workspaceName])) {
    patterns.push(...data[workspaceName])
  }

  const workspaces = data.workspaces
  if (workspaces && typeof workspaces === 'object') {
    if (Array.isArray(workspaces[workspaceKey])) {
      patterns.push(...workspaces[workspaceKey])
    }

    if (workspaceName && Array.isArray(workspaces[workspaceName])) {
      patterns.push(...workspaces[workspaceName])
    }
  }

  return patterns
}

function readPackageName(dir) {
  if (packageNameCache.has(dir)) {
    return packageNameCache.get(dir)
  }

  const pkgPath = path.join(dir, 'package.json')
  if (!fs.existsSync(pkgPath)) {
    packageNameCache.set(dir, null)
    return null
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    const name = typeof pkg.name === 'string' ? pkg.name : null
    packageNameCache.set(dir, name)
    return name
  } catch (error) {
    packageNameCache.set(dir, null)
    return null
  }
}

function resolveCandidates(filename) {
  const dir = path.dirname(filename)
  const base = path.basename(filename).replace(/\.(ts|tsx)$/u, '')
  const candidates = new Set()

  for (const suffix of TEST_FILE_SUFFIXES) {
    candidates.add(path.join(dir, `${base}${suffix}`))
  }

  for (const testDir of TEST_DIRECTORIES) {
    for (const suffix of TEST_FILE_SUFFIXES) {
      candidates.add(path.join(dir, testDir, `${base}${suffix}`))
      const parent = path.dirname(dir)
      if (parent && parent !== dir) {
        candidates.add(path.join(parent, testDir, `${base}${suffix}`))
      }
    }
  }

  return Array.from(candidates)
}

function hasCompanionTest(filename) {
  const candidates = resolveCandidates(filename)
  return candidates.some((candidate) => fs.existsSync(candidate))
}

const requireTestsRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require colocated unit tests for source files',
      recommended: false,
    },
    schema: [
      {
        type: 'object',
        properties: {
          ignore: {
            type: 'array',
            items: { type: 'string' },
          },
          includeDefaults: {
            type: 'boolean',
          },
          requireEnv: {
            type: ['string', 'null'],
          },
          envValue: {
            type: 'string',
          },
        },
        additionalProperties: true,
      },
    ],
    messages: {
      missingTest:
        'Expected a companion test file for {{file}}. Create one of: {{expected}} or add an ignore pattern.',
    },
  },
  create(context) {
    const [optionsFromConfig = {}] = context.options
    const options = { ...DEFAULT_OPTIONS, ...optionsFromConfig }

    if (!shouldEnforce(options)) {
      return {}
    }

    return {
      Program(node) {
        const filename = context.getFilename()

        if (!filename || filename === '<text>') {
          return
        }

        if (!/\.(ts|tsx)$/u.test(filename)) {
          return
        }

        if (/\.(spec|test)\.(ts|tsx)$/u.test(filename)) {
          return
        }

        const cwd = typeof context.getCwd === 'function' ? context.getCwd() : process.cwd()
        const relativePath = path.relative(cwd, filename)

        if (relativePath.startsWith('..')) {
          return
        }

        const ignorePatterns = buildIgnoreList(options, cwd)
        if (isIgnored(relativePath, ignorePatterns)) {
          return
        }

        if (hasCompanionTest(filename)) {
          return
        }

        const expected = resolveCandidates(filename)
          .map((candidate) => path.relative(cwd, candidate))
          .filter((candidate) => !candidate.startsWith('..'))
          .map(normalizePath)

        context.report({
          node,
          messageId: 'missingTest',
          data: {
            file: normalizePath(relativePath),
            expected: Array.from(new Set(expected)).join(', '),
          },
        })
      },
    }
  },
}

const plugin = {
  rules: {
    'require-tests': requireTestsRule,
  },
}

export default plugin
