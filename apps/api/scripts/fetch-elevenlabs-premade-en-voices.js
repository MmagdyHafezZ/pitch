#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { spawnSync } = require('child_process');

const API_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(API_ROOT, '..', '..');
const DEFAULT_OUTPUT_PATH = path.join(
  API_ROOT,
  'tmp',
  'elevenlabs-premade-en-voices.json',
);

function ensureEnvLoaded() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(API_ROOT, '.env'),
    path.resolve(API_ROOT, '.env.local'),
    path.resolve(REPO_ROOT, '.env'),
    path.resolve(REPO_ROOT, '.env.local'),
  ];

  for (const candidate of [...new Set(candidates)]) {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate, override: false, quiet: true });
    }
  }
}

function printUsage() {
  console.log(`Usage:
  pnpm --filter api elevenlabs:voices:premade-en
  pnpm --filter api elevenlabs:voices:premade-en -- --output tmp/my-voices.json

Options:
  --output <path>   Output JSON path
  --help            Show this help message`);
}

function parseArgs(argv) {
  const parsed = {
    output: undefined,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--') {
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }

    if (arg === '--output') {
      const value = argv[index + 1];
      if (value == null || value.startsWith('--')) {
        throw new Error('Missing value for --output.');
      }

      parsed.output = value;
      index += 1;
      continue;
    }

    throw new Error(
      `Unknown option "${arg}". Use --help to see supported options.`,
    );
  }

  return parsed;
}

function requireEnv(name) {
  const value = process.env[name];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `${name} is not set. Add it to your environment or .env file.`,
    );
  }

  return value.trim();
}

function resolveOutputPath(outputPath) {
  if (outputPath) {
    return path.resolve(process.cwd(), outputPath);
  }

  return DEFAULT_OUTPUT_PATH;
}

function fetchVoicesWithCurl(apiKey) {
  const result = spawnSync(
    'curl',
    [
      'https://api.elevenlabs.io/v1/voices',
      '-H',
      `xi-api-key: ${apiKey}`,
      '-H',
      'Accept: application/json',
      '--silent',
      '--show-error',
      '--fail-with-body',
    ],
    {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(
      stderr || stdout || `curl exited with status ${result.status}.`,
    );
  }

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(
      `Failed to parse ElevenLabs voices response as JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function filterPremadeEnglishVoices(voices) {
  return voices
    .filter((voice) => voice?.category === 'premade')
    .filter((voice) => voice?.labels?.language === 'en')
    .map((voice) => ({
      name: voice.name ?? null,
      voice_id: voice.voice_id ?? null,
      category: voice.category ?? null,
      language: voice.labels?.language ?? null,
      gender: voice.labels?.gender ?? null,
      accent: voice.labels?.accent ?? null,
      age: voice.labels?.age ?? null,
      use_case: voice.labels?.use_case ?? null,
      descriptive: voice.labels?.descriptive ?? null,
      preview_url: voice.preview_url ?? null,
    }))
    .sort((left, right) => {
      const leftName = left.name ?? '';
      const rightName = right.name ?? '';
      return leftName.localeCompare(rightName);
    });
}

async function main() {
  ensureEnvLoaded();

  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const apiKey = requireEnv('ELEVENLABS_API_KEY');
  const outputPath = resolveOutputPath(args.output);
  const response = fetchVoicesWithCurl(apiKey);
  const filteredVoices = filterPremadeEnglishVoices(response.voices ?? []);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify(filteredVoices, null, 2) + '\n',
    'utf8',
  );

  console.log(
    `Saved ${filteredVoices.length} premade English voices to ${outputPath}`,
  );
}

main().catch((error) => {
  console.error(
    `Failed to fetch premade English ElevenLabs voices: ${error instanceof Error ? error.message : String(error)}`,
  );
  console.error('Run with --help to see usage.');
  process.exit(1);
});
