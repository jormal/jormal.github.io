import { decryptPayload } from './crypto.js';

const form = document.querySelector('#unlock-form');
const passphraseInput = document.querySelector('#passphrase');
const submitButton = document.querySelector('#unlock-submit');
const status = document.querySelector('#unlock-status');
const protectedContent = document.querySelector('#protected-content');

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

function renderMarkdown(markdown) {
  const fragment = document.createDocumentFragment();
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

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

  return fragment;
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

  try {
    const payload = await loadPayload();
    const plaintext = await decryptPayload(payload, passphrase);

    protectedContent.replaceChildren(renderMarkdown(plaintext));
    protectedContent.hidden = false;
    status.textContent = '보호된 계획을 열었습니다. 이 브라우저에 비밀 구문을 저장하지 않습니다.';
  } catch {
    status.textContent = '비밀 구문이 맞지 않거나, 보호된 계획이 아직 준비되지 않았습니다.';
  } finally {
    passphraseInput.value = '';
    submitButton.disabled = false;
  }
});
