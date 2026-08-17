import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ignoredDirectories = new Set([
  '.git',
  '.idea',
  '.serena',
  'docs',
  'node_modules',
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

    if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(join(directory, entry.name));
    }
  }

  return files;
}

const htmlFiles = await findHtmlFiles(process.cwd());
const errors = [];

if (!htmlFiles.some((file) => relative(process.cwd(), file) === 'index.html')) {
  errors.push('Missing the GitHub Pages entry point: index.html');
}

for (const file of htmlFiles) {
  const content = await readFile(file, 'utf8');
  const path = relative(process.cwd(), file);
  const requiredPatterns = [
    ['a doctype declaration', /<!doctype html>/i],
    ['an html lang attribute', /<html\b[^>]*\blang\s*=\s*["'][^"']+["']/i],
    ['a charset declaration', /<meta\b[^>]*\bcharset\s*=\s*["']?utf-8/i],
    ['a responsive viewport declaration', /<meta\b[^>]*\bname\s*=\s*["']viewport["']/i],
    ['a document title', /<title>\S[\s\S]*?<\/title>/i],
    ['a main landmark', /<main\b/i],
  ];

  for (const [description, pattern] of requiredPatterns) {
    if (!pattern.test(content)) {
      errors.push(`${path}: missing ${description}`);
    }
  }

  for (const image of content.matchAll(/<img\b[^>]*>/gi)) {
    if (!/\balt\s*=\s*["'][^"']*["']/i.test(image[0])) {
      errors.push(`${path}: every img element needs an alt attribute`);
    }
  }

  for (const link of content.matchAll(/<a\b[^>]*>/gi)) {
    if (/\btarget\s*=\s*["']_blank["']/i.test(link[0]) && !/\brel\s*=\s*["'][^"']*\bnoopener\b/i.test(link[0])) {
      errors.push(`${path}: target=_blank links need rel=noopener`);
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
