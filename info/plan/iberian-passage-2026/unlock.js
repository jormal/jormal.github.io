import { decryptPayload } from './crypto.js';

const form = document.querySelector('#unlock-form');
const passphraseInput = document.querySelector('#passphrase');
const submitButton = document.querySelector('#unlock-submit');
const status = document.querySelector('#unlock-status');
const protectedContent = document.querySelector('#protected-content');
const protectedActions = document.querySelector('#protected-actions');
const exportScheduleButton = document.querySelector('#export-schedule');

async function loadPayload() {
  const response = await fetch('./data.enc.json', { cache: 'no-store' });

  if (!response.ok) throw new Error('Protected itinerary is unavailable.');

  return response.json();
}

function addInlineMarkdown(element, value) {
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^\s)]+\))/g;
  let previousIndex = 0;

  for (const match of value.matchAll(pattern)) {
    if (match.index > previousIndex) element.append(document.createTextNode(value.slice(previousIndex, match.index)));

    const token = match[0];
    if (token.startsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = token.slice(2, -2);
      element.append(strong);
    } else {
      const parts = /^\[([^\]]+)\]\(([^\s)]+)\)$/.exec(token);
      const url = parts?.[2];
      if (parts && /^https?:\/\//.test(url)) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = parts[1];
        element.append(link);
      } else {
        element.append(document.createTextNode(token));
      }
    }
    previousIndex = match.index + token.length;
  }

  if (previousIndex < value.length) element.append(document.createTextNode(value.slice(previousIndex)));
}

function tableCells(line) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
}

function isTableDivider(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function appendSafeLink(container, link) {
  if (!link?.label || !/^https:\/\//.test(link.url ?? '')) return;

  const anchor = document.createElement('a');
  anchor.href = link.url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.textContent = link.label;
  container.append(anchor);
}

function renderItinerary(itinerary) {
  const section = document.createElement('section');
  section.className = 'protected-itinerary';

  const title = document.createElement('h2');
  title.textContent = itinerary.title ?? '세부 일정';
  section.append(title);

  for (const day of itinerary.days ?? []) {
    const article = document.createElement('article');
    const heading = document.createElement('h3');
    heading.textContent = `Day ${day.day} · ${day.date} · ${day.location}`;
    article.append(heading);

    const stay = document.createElement('p');
    stay.textContent = `숙박: ${day.stay}`;
    article.append(stay);

    const table = document.createElement('table');
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const label of ['시간', '항목', '일정', '링크·확인']) {
      const cell = document.createElement('th');
      cell.textContent = label;
      headRow.append(cell);
    }
    head.append(headRow);
    table.append(head);

    const body = document.createElement('tbody');
    for (const entry of day.entries ?? []) {
      const row = document.createElement('tr');
      for (const value of [entry.time, entry.category, entry.plan]) {
        const cell = document.createElement('td');
        cell.textContent = value ?? '';
        row.append(cell);
      }

      const links = document.createElement('td');
      const items = [...(entry.links ?? [])];
      if (entry.note) items.push({ label: entry.note });
      items.forEach((item, index) => {
        if (index > 0) links.append(document.createTextNode(' · '));
        if (item.url) appendSafeLink(links, item);
        else links.append(document.createTextNode(item.label));
      });
      row.append(links);
      body.append(row);
    }
    table.append(body);
    article.append(table);
    section.append(article);
  }

  return section;
}

function prepareTables(fragment) {
  for (const table of fragment.querySelectorAll('table')) {
    const headers = [...table.querySelectorAll('th')].map((header) => header.textContent?.trim());
    if (headers.includes('항목')) table.classList.add('schedule-table');

    const wrapper = document.createElement('div');
    wrapper.className = 'protected-table-scroll';
    table.replaceWith(wrapper);
    wrapper.append(table);
  }

  return fragment;
}

function scheduleTable() {
  return [...protectedContent.querySelectorAll('.schedule-table')].find((table) => {
    const headers = [...table.querySelectorAll('thead th')].map((header) => header.textContent?.trim());
    return headers.includes('Day') && headers.includes('도시·숙박') && headers.includes('항목');
  }) ?? protectedContent.querySelector('.schedule-table');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportScheduleImage() {
  const table = scheduleTable();
  if (!table) return;

  const width = Math.ceil(table.scrollWidth);
  const height = Math.ceil(table.scrollHeight);
  const tableRect = table.getBoundingClientRect();
  const escapeXml = (value) => value.replace(/[<>&'"]/g, (character) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[character]));
  const cells = [...table.querySelectorAll('th, td')].map((cell) => {
    const cellRect = cell.getBoundingClientRect();
    const x = Math.round(cellRect.left - tableRect.left + 32);
    const y = Math.round(cellRect.top - tableRect.top + 72);
    const text = (cell.innerText || cell.textContent || '').replace(/\s*\n\s*/g, ' · ').trim();
    const header = cell.tagName === 'TH';
    return `<rect x="${x}" y="${y}" width="${Math.round(cellRect.width)}" height="${Math.round(cellRect.height)}" fill="${header ? '#e4e7df' : '#f7f7f1'}" stroke="#c8ccc3" /><text x="${x + 9}" y="${y + 20}" fill="${header ? '#59645b' : '#263027'}" font-family="Arial, sans-serif" font-size="${header ? 11 : 14}" font-weight="${header ? 700 : 400}">${escapeXml(text)}</text>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width + 64}" height="${height + 104}" viewBox="0 0 ${width + 64} ${height + 104}"><rect width="100%" height="100%" fill="#ecebe3" /><text x="32" y="36" fill="#263027" font-family="Arial, sans-serif" font-size="22" font-weight="700">16일 세부 일정</text>${cells}</svg>`;
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });

  try {
    const url = URL.createObjectURL(svgBlob);
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width + 64;
    canvas.height = height + 112;
    canvas.getContext('2d').drawImage(image, 0, 0);
    URL.revokeObjectURL(url);
    const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!png) throw new Error('PNG export failed.');
    downloadBlob(png, 'iberian-passage-2026-schedule.png');
  } catch {
    downloadBlob(svgBlob, 'iberian-passage-2026-schedule.svg');
  }
}

function renderHtml(html) {
  const allowedTags = new Set(['A', 'ARTICLE', 'BLOCKQUOTE', 'BR', 'EM', 'H1', 'H2', 'H3', 'LI', 'OL', 'P', 'SECTION', 'SMALL', 'STRONG', 'TABLE', 'TBODY', 'TD', 'TH', 'THEAD', 'TR', 'UL']);
  const parsed = new DOMParser().parseFromString(html, 'text/html');

  function sanitize(node) {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent ?? '');
    if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();

    if (!allowedTags.has(node.tagName)) {
      const fragment = document.createDocumentFragment();
      for (const child of node.childNodes) fragment.append(sanitize(child));
      return fragment;
    }

    const element = document.createElement(node.tagName.toLowerCase());
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') ?? '';
      if (/^https:\/\//.test(href)) {
        element.href = href;
        element.target = '_blank';
        element.rel = 'noopener noreferrer';
      }
    }
    if (node.tagName === 'TD' || node.tagName === 'TH') {
      for (const attribute of ['colspan', 'rowspan']) {
        const value = node.getAttribute(attribute);
        if (/^[1-9]\d?$/.test(value ?? '')) element.setAttribute(attribute, value);
      }
    }
    if (node.tagName === 'TH' && node.getAttribute('scope') === 'row') element.scope = 'row';

    for (const child of node.childNodes) element.append(sanitize(child));
    return element;
  }

  const fragment = document.createDocumentFragment();
  for (const child of parsed.body.childNodes) fragment.append(sanitize(child));

  return prepareTables(fragment);
}

function renderMarkdown(markdown) {
  const fragment = document.createDocumentFragment();
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    if (line.trim() === ':::itinerary') {
      const payloadLines = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== ':::') {
        payloadLines.push(lines[index]);
        index += 1;
      }
      if (lines[index]?.trim() === ':::') index += 1;

      try {
        fragment.append(renderItinerary(JSON.parse(payloadLines.join('\n'))));
      } catch {
        const message = document.createElement('p');
        message.textContent = '세부 일정을 표시할 수 없습니다.';
        fragment.append(message);
      }
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const title = document.createElement(`h${heading[1].length + 1}`);
      addInlineMarkdown(title, heading[2]);
      fragment.append(title);
      index += 1;
      continue;
    }

    if (line.startsWith('> ')) {
      const quote = document.createElement('blockquote');
      const paragraph = document.createElement('p');
      const quoteLines = [];
      while (index < lines.length && lines[index].startsWith('> ')) {
        quoteLines.push(lines[index].slice(2));
        index += 1;
      }
      addInlineMarkdown(paragraph, quoteLines.join(' '));
      quote.append(paragraph);
      fragment.append(quote);
      continue;
    }

    if (line.includes('|') && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const table = document.createElement('table');
      const head = document.createElement('thead');
      const headRow = document.createElement('tr');
      for (const cell of tableCells(line)) {
        const header = document.createElement('th');
        addInlineMarkdown(header, cell);
        headRow.append(header);
      }
      head.append(headRow);
      table.append(head);
      index += 2;
      const body = document.createElement('tbody');
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        const row = document.createElement('tr');
        for (const cell of tableCells(lines[index])) {
          const data = document.createElement('td');
          addInlineMarkdown(data, cell);
          row.append(data);
        }
        body.append(row);
        index += 1;
      }
      table.append(body);
      fragment.append(table);
      continue;
    }

    if (/^-\s+/.test(line)) {
      const list = document.createElement('ul');
      while (index < lines.length && /^-\s+/.test(lines[index])) {
        const item = document.createElement('li');
        addInlineMarkdown(item, lines[index].replace(/^-\s+/, ''));
        list.append(item);
        index += 1;
      }
      fragment.append(list);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const list = document.createElement('ol');
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        const item = document.createElement('li');
        addInlineMarkdown(item, lines[index].replace(/^\d+\.\s+/, ''));
        list.append(item);
        index += 1;
      }
      fragment.append(list);
      continue;
    }

    const paragraphLines = [];
    while (
      index < lines.length && lines[index].trim() &&
      !/^(#{1,3})\s+/.test(lines[index]) && !lines[index].startsWith('> ') &&
      !/^-\s+/.test(lines[index]) && !/^\d+\.\s+/.test(lines[index]) &&
      !(lines[index].includes('|') && index + 1 < lines.length && isTableDivider(lines[index + 1]))
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    const paragraph = document.createElement('p');
    addInlineMarkdown(paragraph, paragraphLines.join(' '));
    fragment.append(paragraph);
  }

  return prepareTables(fragment);
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const passphrase = passphraseInput.value;

  if (!passphrase) {
    status.textContent = '비밀 구문을 입력해 주세요.';
    passphraseInput.focus();
    return;
  }

  submitButton.disabled = true;
  status.textContent = '보호된 계획을 여는 중입니다…';
  protectedContent.hidden = true;
  protectedActions.hidden = true;

  try {
    const payload = await loadPayload();
    const plaintext = await decryptPayload(payload, passphrase);

    const content = plaintext.trimStart().startsWith('<') ? renderHtml(plaintext) : renderMarkdown(plaintext);
    protectedContent.replaceChildren(content);
    protectedContent.hidden = false;
    protectedActions.hidden = !scheduleTable();
    status.textContent = '보호된 계획을 열었습니다. 이 브라우저에 비밀 구문을 저장하지 않습니다.';
  } catch {
    status.textContent = '비밀 구문이 맞지 않거나, 보호된 계획이 아직 준비되지 않았습니다.';
  } finally {
    passphraseInput.value = '';
    submitButton.disabled = false;
  }
});

exportScheduleButton?.addEventListener('click', exportScheduleImage);
