import { execFile } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join, relative } from 'node:path';

const execFileAsync = promisify(execFile);

const ignoredDirectories = new Set([
  '.git',
  '.idea',
  '.serena',
  'docs',
  'node_modules',
  'private',
]);

async function findHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...(await findHtmlFiles(join(directory, entry.name))));
      }
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.html')) files.push(join(directory, entry.name));
  }

  return files;
}

const htmlFiles = await findHtmlFiles(process.cwd());
const errors = [];

function isEncryptedPayload(payload) {
  return payload?.version === 1
    && payload.algorithm === 'AES-GCM'
    && payload.kdf === 'PBKDF2'
    && payload.hash === 'SHA-256'
    && Number.isSafeInteger(payload.iterations) && payload.iterations >= 100000
    && ['salt', 'iv', 'ciphertext'].every((key) => typeof payload[key] === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(payload[key]));
}

let planEntries = [];
try {
  planEntries = await readdir(join(process.cwd(), 'info', 'plan'), { withFileTypes: true });
} catch {
  // Plans are optional for generic static-site verification.
}

for (const entry of planEntries.filter((entry) => entry.isDirectory())) {
  const planDirectory = join(process.cwd(), 'info', 'plan', entry.name);
  const payloadEntries = await readdir(planDirectory, { withFileTypes: true });

  for (const payloadEntry of payloadEntries.filter((item) => item.isFile() && item.name.endsWith('.enc.json'))) {
    const payloadPath = join(planDirectory, payloadEntry.name);
    let payloadStat;
    try {
      if (!isEncryptedPayload(JSON.parse(await readFile(payloadPath, 'utf8')))) {
        errors.push(`${relative(process.cwd(), payloadPath)}: invalid encrypted payload shape`);
      }
      payloadStat = await stat(payloadPath);
    } catch {
      errors.push(`${relative(process.cwd(), payloadPath)}: invalid encrypted payload shape`);
      continue;
    }

    const name = payloadEntry.name === 'data.enc.json'
      ? entry.name
      : `${entry.name}.${payloadEntry.name.slice(0, -'.enc.json'.length)}`;
    for (const extension of ['html', 'md']) {
      const plaintextPath = join(process.cwd(), 'private', `${name}.${extension}`);
      try {
        if ((await stat(plaintextPath)).mtimeMs > payloadStat.mtimeMs) {
          errors.push(`${relative(process.cwd(), payloadPath)}: older than private/${name}.${extension}; re-encrypt before finishing`);
        }
      } catch {
        // private/ is absent in CI, and a plan may not have a plaintext source.
      }
    }
  }

  try {
    const privateEntries = await readdir(join(process.cwd(), 'private'), { withFileTypes: true });
    for (const source of privateEntries.filter((item) => item.isFile() && item.name.startsWith(`${entry.name}.`) && item.name.endsWith('.md'))) {
      const name = source.name.slice(entry.name.length + 1, -'.md'.length);
      if (name && !payloadEntries.some((item) => item.name === `${name}.enc.json`)) {
        errors.push(`info/plan/${entry.name}/${name}.enc.json: missing encrypted payload for private/${source.name}`);
      }
    }
  } catch {
    // private/ is absent in CI.
  }
}

try {
  const { stdout } = await execFileAsync('git', ['ls-files', 'private']);
  for (const file of stdout.trim().split('\n').filter(Boolean)) {
    errors.push(`${file}: private files must not be tracked`);
  }
} catch {
  // Git is optional for generic static-site verification.
}

if (!htmlFiles.some((file) => relative(process.cwd(), file) === 'index.html')) {
  errors.push('Missing the GitHub Pages entry point: index.html');
}

for (const file of htmlFiles) {
  const content = await readFile(file, 'utf8');
  const filePath = relative(process.cwd(), file);
  const requirements = [
    ['a doctype declaration', /<!doctype html>/i],
    ['an html lang attribute', /<html\b[^>]*\blang\s*=\s*["'][^"']+["']/i],
    ['a charset declaration', /<meta\b[^>]*\bcharset\s*=\s*["']?utf-8/i],
    ['a responsive viewport declaration', /<meta\b[^>]*\bname\s*=\s*["']viewport["']/i],
    ['a document title', /<title>\S[\s\S]*?<\/title>/i],
    ['a main landmark', /<main\b/i],
  ];

  for (const [description, pattern] of requirements) {
    if (!pattern.test(content)) errors.push(`${filePath}: missing ${description}`);
  }

  for (const image of content.matchAll(/<img\b[^>]*>/gi)) {
    if (!/\balt\s*=\s*["'][^"']*["']/i.test(image[0])) {
      errors.push(`${filePath}: every img element needs an alt attribute`);
    }
  }

  for (const link of content.matchAll(/<a\b[^>]*>/gi)) {
    if (/\btarget\s*=\s*["']_blank["']/i.test(link[0]) && !/\brel\s*=\s*["'][^"']*\bnoopener\b/i.test(link[0])) {
      errors.push(`${filePath}: target=_blank links need rel=noopener`);
    }
  }
}

if (errors.length > 0) {
  console.error('Static-site verification failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Static-site verification passed for ${htmlFiles.length} HTML file(s).`);
}
