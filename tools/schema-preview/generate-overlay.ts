import { watch } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { register } from 'tsx/esm/api';

import { generatePreview } from './preview-renderer';

const WORKBENCH_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const INPUT_PATH = fileURLToPath(new URL('./input.jpg', import.meta.url));
const SCHEMA_PATH = fileURLToPath(new URL('./schema.ts', import.meta.url));
const OUTPUT_PATH = fileURLToPath(new URL('./output.png', import.meta.url));
const RESULT_PATH = fileURLToPath(new URL('./result.json', import.meta.url));
const WATCHED_FILES = new Set([basename(INPUT_PATH), basename(SCHEMA_PATH)]);
let schemaLoadSequence = 0;

async function loadSchema() {
  schemaLoadSequence += 1;
  const scopedLoader = register({ namespace: `schema-preview-${schemaLoadSequence}` });
  try {
    const schemaModule = (await scopedLoader.import('./schema.ts', import.meta.url)) as {
      schema?: unknown;
    };
    if (!('schema' in schemaModule)) {
      throw new Error(`${SCHEMA_PATH} must export a value named "schema".`);
    }
    return schemaModule.schema;
  } finally {
    await scopedLoader.unregister();
  }
}

async function removeStaleOutputs() {
  for (const path of [OUTPUT_PATH, RESULT_PATH]) {
    await unlink(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

async function regenerate() {
  try {
    const schema = await loadSchema();
    const result = await generatePreview(schema, INPUT_PATH, OUTPUT_PATH, RESULT_PATH);
    console.log(
      `[schema:preview] Created ${OUTPUT_PATH} and ${RESULT_PATH} · ${result.questionCount} questions · ${result.bubbleCount} bubbles · ${result.width}×${result.height}px`,
    );
    return true;
  } catch (error) {
    await removeStaleOutputs();
    console.error(`[schema:preview] ${error instanceof Error ? error.message : String(error)}`);
    console.error('[schema:preview] output.png and result.json were removed so stale diagnostics cannot be mistaken for this schema.');
    return false;
  }
}

function startWatchMode() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let queued = false;

  const runLatest = async () => {
    if (running) {
      queued = true;
      return;
    }
    running = true;
    do {
      queued = false;
      await regenerate();
    } while (queued);
    running = false;
  };

  void runLatest();
  const watcher = watch(WORKBENCH_DIRECTORY, (_eventType, filename) => {
    if (!filename || !WATCHED_FILES.has(filename.toString())) return;
    clearTimeout(timer);
    timer = setTimeout(() => void runLatest(), 100);
  });
  watcher.on('error', (error) => console.error(`[schema:preview] Watch error: ${error.message}`));
  console.log(`[schema:preview] Watching ${INPUT_PATH} and ${SCHEMA_PATH}`);
}

async function main() {
  const argumentsAfterScript = process.argv.slice(2).filter((argument) => argument !== '--');
  const watchMode = argumentsAfterScript.includes('--watch');
  const unexpectedArguments = argumentsAfterScript.filter((argument) => argument !== '--watch');

  if (unexpectedArguments.length > 0) {
    console.error('[schema:preview] This workbench uses fixed input.jpg, schema.ts, output.png, and result.json paths; positional arguments are not supported.');
    process.exitCode = 1;
  } else if (watchMode) {
    startWatchMode();
  } else {
    const succeeded = await regenerate();
    if (!succeeded) process.exitCode = 1;
  }
}

void main();
