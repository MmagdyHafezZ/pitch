#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const DEFAULT_VOICE_ID = 'y26Xv4PQ7Ftbu1mfaEFY';
const DEFAULT_MODEL_ID = 'eleven_v2_flash';
const DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128';
const API_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(API_ROOT, '..', '..');

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
  pnpm --filter api elevenlabs:timestamps:fetch -- --text "Hello there"
  pnpm --filter api elevenlabs:timestamps:fetch -- --text-file ./sample.txt

Options:
  --text <value>           Inline text to synthesize
  --text-file <path>       Path to a UTF-8 text file to synthesize
  --voice-id <value>       ElevenLabs voice ID (default: ${DEFAULT_VOICE_ID})
  --model-id <value>       Model ID (default: ELEVENLABS_MODEL_ID or ${DEFAULT_MODEL_ID})
  --output-format <value>  Output format (default: ELEVENLABS_OUTPUT_FORMAT or ${DEFAULT_OUTPUT_FORMAT})
  --output <path>          Output JSON path
  --help                   Show this help message`);
}

function parseArgs(argv) {
  const parsed = {
    text: undefined,
    textFile: undefined,
    voiceId: DEFAULT_VOICE_ID,
    modelId: undefined,
    outputFormat: undefined,
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

    if (!arg.startsWith('--')) {
      throw new Error(
        `Unexpected argument "${arg}". Use --help to see supported options.`,
      );
    }

    const value = argv[index + 1];
    if (value == null || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}.`);
    }

    switch (arg) {
      case '--text':
        parsed.text = value;
        break;
      case '--text-file':
        parsed.textFile = value;
        break;
      case '--voice-id':
        parsed.voiceId = value;
        break;
      case '--model-id':
        parsed.modelId = value;
        break;
      case '--output-format':
        parsed.outputFormat = value;
        break;
      case '--output':
        parsed.output = value;
        break;
      default:
        throw new Error(
          `Unknown option "${arg}". Use --help to see supported options.`,
        );
    }

    index += 1;
  }

  return parsed;
}

function resolveText(args) {
  const hasInlineText = typeof args.text === 'string';
  const hasTextFile = typeof args.textFile === 'string';

  if (hasInlineText === hasTextFile) {
    throw new Error('Provide exactly one input source: --text or --text-file.');
  }

  if (hasInlineText) {
    if (args.text.trim().length === 0) {
      throw new Error('The --text value cannot be empty.');
    }

    return args.text;
  }

  const textFilePath = path.resolve(process.cwd(), args.textFile);

  if (!fs.existsSync(textFilePath)) {
    throw new Error(`Text file not found: ${textFilePath}`);
  }

  const text = fs.readFileSync(textFilePath, 'utf8');
  if (text.trim().length === 0) {
    throw new Error(`Text file is empty: ${textFilePath}`);
  }

  return text;
}

function resolveOutputPath(outputPath, voiceId) {
  if (outputPath) {
    return path.resolve(process.cwd(), outputPath);
  }

  return path.join(
    API_ROOT,
    'tmp',
    `elevenlabs-${voiceId}-with-timestamps.json`,
  );
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

function summarizeApiError(bodyText) {
  const normalized = bodyText.replace(/\s+/g, ' ').trim();
  const snippet =
    normalized.length > 300 ? `${normalized.slice(0, 300)}...` : normalized;
  return snippet || 'No response body returned.';
}

async function fetchTimestamps({
  apiKey,
  voiceId,
  text,
  modelId,
  outputFormat,
}) {
  const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      output_format: outputFormat,
    }),
  });

  const rawBody = await response.text();

  if (!response.ok) {
    throw new Error(
      `ElevenLabs request failed with ${response.status} ${response.statusText}: ${summarizeApiError(
        rawBody,
      )}`,
    );
  }

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    throw new Error(
      `ElevenLabs returned a non-JSON response: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function main() {
  ensureEnvLoaded();

  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const apiKey = requireEnv('ELEVENLABS_API_KEY');
  const text = resolveText(args);
  const voiceId = args.voiceId.trim() || DEFAULT_VOICE_ID;
  const modelId = (
    args.modelId ||
    process.env.ELEVENLABS_MODEL_ID ||
    DEFAULT_MODEL_ID
  ).trim();
  const outputFormat = (
    args.outputFormat ||
    process.env.ELEVENLABS_OUTPUT_FORMAT ||
    DEFAULT_OUTPUT_FORMAT
  ).trim();
  const outputPath = resolveOutputPath(args.output, voiceId);

  const responseBody = await fetchTimestamps({
    apiKey,
    voiceId,
    text,
    modelId,
    outputFormat,
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify(responseBody, null, 2) + '\n',
    'utf8',
  );

  const hasAlignment =
    responseBody != null &&
    typeof responseBody === 'object' &&
    ('alignment' in responseBody || 'normalized_alignment' in responseBody);

  console.log(`Saved ElevenLabs timestamps JSON to ${outputPath}`);
  console.log(`Voice ID: ${voiceId}`);
  console.log(`Model ID: ${modelId}`);
  console.log(`Alignment blocks returned: ${hasAlignment ? 'yes' : 'no'}`);
}

main().catch((error) => {
  console.error(
    `Failed to fetch ElevenLabs timestamps: ${error instanceof Error ? error.message : String(error)}`,
  );
  console.error('Run with --help to see usage.');
  process.exit(1);
});
