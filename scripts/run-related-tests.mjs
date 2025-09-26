import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const fileArgs = process.argv.slice(2);

if (fileArgs.length === 0) {
  process.exit(0);
}

const workspaceMap = new Map();

for (const relativeFile of fileArgs) {
  const absolutePath = path.resolve(repoRoot, relativeFile);

  if (!absolutePath.endsWith('.ts') && !absolutePath.endsWith('.tsx')) {
    continue;
  }

  if (!fs.existsSync(absolutePath)) {
    continue;
  }

  const workspaceDir = findWorkspaceDir(path.dirname(absolutePath));
  if (!workspaceDir) {
    continue;
  }

  const pkgJsonPath = path.join(workspaceDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

  if (!pkg.name || !pkg.scripts || !pkg.scripts.test) {
    continue;
  }

  const existing = workspaceMap.get(workspaceDir) ?? {
    packageName: pkg.name,
    files: new Set(),
  };

  existing.files.add(toPosix(path.relative(workspaceDir, absolutePath)));
  workspaceMap.set(workspaceDir, existing);
}

if (workspaceMap.size === 0) {
  process.exit(0);
}

for (const { packageName, files } of workspaceMap.values()) {
  const fileList = Array.from(files).filter(Boolean);

  if (fileList.length === 0) {
    continue;
  }

  const jestArgs = ['--bail', '--runInBand', '--findRelatedTests', ...fileList];
  const result = spawnSync('pnpm', ['--filter', packageName, 'test', '--', ...jestArgs], {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

process.exit(0);

function findWorkspaceDir(startDir) {
  let current = startDir;
  while (current && current !== repoRoot && current !== path.dirname(current)) {
    const candidate = path.join(current, 'package.json');
    if (fs.existsSync(candidate)) {
      return current;
    }
    current = path.dirname(current);
  }
  return null;
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}
