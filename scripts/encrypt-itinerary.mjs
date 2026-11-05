import { access, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import { createEncryptedPayload } from '../info/plan/iberian-passage-2026/crypto.js';

function parseArguments(argumentsList) {
  const values = new Map();

  for (let index = 0; index < argumentsList.length; index += 1) {
    const key = argumentsList[index];
    if (key === '--replace') {
      values.set(key, true);
      continue;
    }
    const value = argumentsList[index + 1];
    if (!key?.startsWith('--') || !value) throw new Error('Expected --input <file> --output <file> [--replace].');

    values.set(key, value);
    index += 1;
  }

  return values;
}

function askForHiddenValue(prompt) {
  if (!process.stdin.isTTY) throw new Error('Run this command from an interactive terminal.');

  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  return new Promise((resolveValue, rejectValue) => {
    let value = '';

    const finish = () => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      resolveValue(value);
    };

    const fail = () => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      rejectValue(new Error('Passphrase entry cancelled.'));
    };

    const onData = (character) => {
      if (character === '\u0003') return fail();
      if (character === '\r' || character === '\n') return finish();
      if (character === '\u007f' || character === '\b') {
        value = value.slice(0, -1);
        return;
      }
      value += character;
    };

    process.stdin.on('data', onData);
  });
}

const values = parseArguments(process.argv.slice(2));
const rootDirectory = process.cwd();
const inputPath = resolve(rootDirectory, values.get('--input') ?? '');
const outputPath = resolve(rootDirectory, values.get('--output') ?? '');
const privateDirectory = resolve(rootDirectory, 'private');

if (!relative(privateDirectory, inputPath) || relative(privateDirectory, inputPath).startsWith('..')) {
  throw new Error('The plaintext input must be inside private/.');
}

try {
  await access(outputPath, constants.F_OK);
  if (!values.get('--replace')) throw new Error(`Refusing to overwrite ${relative(rootDirectory, outputPath)} without --replace.`);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const firstPassphrase = process.env.ITINERARY_PASSPHRASE ?? await askForHiddenValue('New itinerary passphrase: ');
const secondPassphrase = process.env.ITINERARY_PASSPHRASE ? firstPassphrase : await askForHiddenValue('Confirm passphrase: ');

if (firstPassphrase.length < 4) throw new Error('Use a passphrase of at least 4 characters.');
if (firstPassphrase.length < 12) {
  console.warn('Warning: short passphrases are easier to guess. Use this only for low-sensitivity sharing.');
}
if (firstPassphrase !== secondPassphrase) throw new Error('Passphrases do not match.');

const plaintext = await readFile(inputPath, 'utf8');
const payload = await createEncryptedPayload(plaintext, firstPassphrase);

await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', flag: values.get('--replace') ? 'w' : 'wx' });
console.log(`Encrypted itinerary written to ${relative(rootDirectory, outputPath)}.`);
