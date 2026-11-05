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

// Fixed plan structure: h2 big sections; h3 sub-sections only per city (or 공통) or per day.
// Section 2 holds exactly one day table, whose day sub-sections are built at render time.
const allowedSubsections = /^(공통|Helsinki|Helsinki · (출국|귀국)|Madrid|Porto|Lisbon|Sevilla|Granada|Barcelona)$/;
for (const entry of planEntries.filter((item) => item.isDirectory())) {
  let plaintext;
  try {
    plaintext = await readFile(join(process.cwd(), 'private', `${entry.name}.html`), 'utf8');
  } catch {
    continue; // private/ is absent in CI.
  }
  const label = `private/${entry.name}.html`;
  for (const [, heading] of plaintext.matchAll(/<h3>([\s\S]*?)<\/h3>/g)) {
    const text = heading.replace(/<[^>]*>/g, '').trim();
    if (!allowedSubsections.test(text)) errors.push(`${label}: h3 "${text}" is not a city sub-section`);
  }
  const detailStart = plaintext.search(/<h2>2\./);
  const detailEnd = plaintext.search(/<h2>3\./);
  if (detailStart !== -1 && detailEnd > detailStart) {
    const tables = plaintext.slice(detailStart, detailEnd).match(/<table\b/g)?.length ?? 0;
    if (tables !== 1) errors.push(`${label}: section 2 must hold exactly one day table (found ${tables})`);
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

// Travel logs write their totals statically; recompute them from the itemized amounts.
function parseEuro(text) {
  const match = text.replace(/<[^>]*>/g, '').match(/€\s*(-?\d+(?:\.\d+)?)/);
  return match ? Math.round(Number(match[1]) * 100) : null;
}

let logEntries = [];
try {
  logEntries = await readdir(join(process.cwd(), 'info', 'log'), { withFileTypes: true });
} catch {
  // Travel logs are optional.
}

for (const entry of logEntries.filter((item) => item.isDirectory())) {
  const logPath = join(process.cwd(), 'info', 'log', entry.name, 'index.html');
  let content;
  try {
    content = await readFile(logPath, 'utf8');
  } catch {
    continue;
  }
  const filePath = relative(process.cwd(), logPath);
  const expected = new Map([['all', 0], ['refund', 0]]);
  const add = (key, cents) => expected.set(key, (expected.get(key) ?? 0) + cents);
  const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

  // Each day block owns the entries between its opening tag and the next day block.
  const daySplits = content.split(/(?=<details\b[^>]*\bdata-day=")/);
  for (const chunk of daySplits.slice(1)) {
    const day = attr(chunk.match(/^<details\b[^>]*>/)[0], 'data-day');
    for (const [item, tag] of chunk.matchAll(/(<li\b[^>]*\bdata-amount="[^"]*"[^>]*>)[\s\S]*?<\/li>/g)) {
      const cents = Math.round(Number(attr(tag, 'data-amount')) * 100);
      const shown = item.match(/class="log-spend[^"]*">\s*<strong>([^<]*)<\/strong>/)?.[1] ?? '';
      if (parseEuro(shown) !== cents) errors.push(`${filePath}: entry shows "${shown}" but data-amount is ${attr(tag, 'data-amount')}`);
      const category = attr(tag, 'data-category');
      const city = attr(tag, 'data-city');
      if (!Number.isFinite(cents) || !category || !city) {
        errors.push(`${filePath}: log entry needs numeric data-amount, data-category and data-city`);
        continue;
      }
      add('all', cents);
      add(`day:${day}`, cents);
      add(`category:${category}`, cents);
      add(`city:${city}`, cents);
      if (attr(tag, 'data-refund')) add('refund', cents);
    }
  }

  let ledger = 0;
  for (const [tag] of content.matchAll(/<tr\b[^>]*\bdata-ledger-amount="([^"]*)"[^>]*>/g)) {
    ledger += Math.round(Number(attr(tag, 'data-ledger-amount')) * 100);
  }
  if (ledger !== expected.get('all')) {
    errors.push(`${filePath}: ledger sum ${ledger / 100} does not match itemized sum ${expected.get('all') / 100}`);
  }

  const seen = new Set();
  for (const [, key, inner] of content.matchAll(/<[a-z]+\b[^>]*\bdata-total="([^"]+)"[^>]*>([\s\S]*?)<\/[a-z]+>/g)) {
    seen.add(key);
    const shown = parseEuro(inner);
    const want = expected.get(key) ?? 0;
    if (shown !== want) errors.push(`${filePath}: data-total="${key}" shows ${inner.trim()} but items sum to €${(want / 100).toFixed(2)}`);
  }
  for (const key of expected.keys()) {
    if (expected.get(key) !== 0 && !seen.has(key)) errors.push(`${filePath}: missing a data-total="${key}" figure`);
  }
}

// The service worker precache list must name files that exist, so the offline copy cannot go stale.
let serviceWorker = null;
try {
  serviceWorker = await readFile(join(process.cwd(), 'sw.js'), 'utf8');
} catch {
  // The service worker is optional for generic static-site verification.
}
if (serviceWorker !== null) {
  const block = serviceWorker.match(/\/\/ PRECACHE-START([\s\S]*?)\/\/ PRECACHE-END/)?.[1];
  const entries = block ? [...block.matchAll(/'([^']*)'/g)].map((match) => match[1]) : [];
  if (!entries.length) errors.push('sw.js: missing the PRECACHE-START/PRECACHE-END list');
  if (!/const CACHE_VERSION = '[^']+'/.test(serviceWorker)) errors.push('sw.js: missing a CACHE_VERSION string');
  const essential = serviceWorker.match(/const ESSENTIAL = \[([\s\S]*?)\];/)?.[1] ?? '';
  for (const [, entry] of essential.matchAll(/'([^']*)'/g)) {
    if (!entries.includes(entry)) errors.push(`sw.js: essential entry "${entry}" is not in the precache list`);
  }
  for (const entry of entries) {
    if (entry.startsWith('/') || entry.includes('..') || /^[a-z]+:/i.test(entry)) {
      errors.push(`sw.js: precache entry "${entry}" must be a site-root-relative path`);
      continue;
    }
    const file = entry === './' || entry.endsWith('/') ? join(entry, 'index.html') : entry;
    try {
      if (!(await stat(join(process.cwd(), file))).isFile()) throw new Error('not a file');
    } catch {
      errors.push(`sw.js: precache entry "${entry}" has no file at ${file}`);
    }
    if (entry.startsWith('private/') || entry.includes('.principles.')) {
      errors.push(`sw.js: precache entry "${entry}" must not expose private material`);
    }
  }
  for (const file of htmlFiles) {
    const content = await readFile(file, 'utf8');
    const filePath = relative(process.cwd(), file);
    const script = content.match(/<script\b[^>]*\bsrc="([^"]*offline\.js)"/)?.[1];
    if (!script) continue;
    const page = filePath === 'index.html' ? './' : `${filePath.replace(/index\.html$/, '')}`;
    if (!entries.includes(page) && !entries.includes(filePath)) {
      errors.push(`${filePath}: registers the offline copy but is missing from the sw.js precache list`);
    }
    try {
      await stat(join(process.cwd(), filePath, '..', script));
    } catch {
      errors.push(`${filePath}: offline script path ${script} does not resolve`);
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
