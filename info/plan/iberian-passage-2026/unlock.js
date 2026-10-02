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
    const headers = [...(table.tHead?.rows[0]?.cells ?? [])].map((header) => header.textContent?.trim());
    if (headers[0] === '날짜') table.classList.add('date-first-table');
    if (headers[0] === '도시') table.classList.add('city-first-table');
    if (headers.includes('시간') && headers.includes('항목')) table.classList.add('schedule-table');
    if (headers.length <= 5) table.classList.add('compact-table');
    if (headers.length === 2 && headers[0] === '항목') table.classList.add('item-detail-table');
    if (headers[0] === '일차' && headers.includes('고정 시각')) markSummaryCities(table);

    const wrapper = document.createElement('div');
    wrapper.className = 'protected-table-scroll';
    table.replaceWith(wrapper);
    wrapper.append(table);
  }

  return fragment;
}

const summaryCities = ['helsinki', 'madrid', 'porto', 'lisbon', 'sevilla', 'granada', 'barcelona'];

// One summary row per day: colour each row by the city slept in, keep keywords and times from breaking mid-phrase.
function markSummaryCities(table) {
  table.classList.add('summary-table');
  let previous = '';
  for (const row of table.tBodies[0]?.rows ?? []) {
    const cityCell = row.cells[1];
    const label = (cityCell?.childNodes[0]?.textContent ?? '').trim();
    const parts = label.split('→').map((part) => part.trim().toLowerCase());
    const isFlight = cityCell?.textContent?.includes('기내');
    const city = isFlight ? null : parts.find((part) => summaryCities.includes(part) && part !== parts[0]) ?? parts.find((part) => summaryCities.includes(part));
    row.classList.add(city ? `city-${city}` : 'city-flight');
    if (parts.length > 1) row.classList.add('is-moving');
    // Later nights in the same city carry no stay line; fade them so city changes stand out.
    else if (city && city === previous && !cityCell.querySelector('small')) row.classList.add('is-repeat');
    previous = city ?? '';

    const plan = row.cells[2];
    if (plan && plan.children.length === 0) {
      const items = (plan.textContent ?? '').split(' · ');
      plan.replaceChildren(...items.flatMap((item, index) => {
        const span = document.createElement('span');
        span.className = 'summary-item';
        span.textContent = item;
        if (/\(후보\)/.test(item)) span.classList.add('is-candidate');
        return index ? [document.createTextNode(' · '), span] : [span];
      }));
    }

    const times = row.cells[3];
    for (const node of [...(times?.childNodes ?? [])]) {
      const match = node.nodeType === Node.TEXT_NODE && node.textContent?.match(/^(\s*)(\d{2}:\d{2})\s/);
      if (!match) continue;
      const time = document.createElement('span');
      time.className = 'summary-time';
      time.textContent = match[2];
      node.textContent = node.textContent.slice(match[0].length);
      node.before(time);
    }
    for (const node of [...(times?.childNodes ?? [])]) {
      if (node.nodeType !== Node.TEXT_NODE || !/\(후보\)/.test(node.textContent ?? '')) continue;
      const candidate = document.createElement('span');
      candidate.className = 'is-candidate';
      node.replaceWith(candidate);
      candidate.append(node);
    }
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeXml(value) {
  return value.replace(/[<>&'"]/g, (character) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[character]));
}

function safeFilename(value) {
  return value.replace(/[^a-z0-9가-힣]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'itinerary';
}

async function exportTableImage(table, title, filename, body = null) {
  const cells = [
    ...table.querySelectorAll('thead th'),
    ...(body ? [...body.querySelectorAll('th, td')] : [...table.querySelectorAll('tbody th, tbody td')]),
  ];
  if (!cells.length) return;

  const bounds = cells.reduce((result, cell) => {
    const rect = cell.getBoundingClientRect();
    return {
      left: Math.min(result.left, rect.left),
      top: Math.min(result.top, rect.top),
      right: Math.max(result.right, rect.right),
      bottom: Math.max(result.bottom, rect.bottom),
    };
  }, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
  const width = Math.ceil(bounds.right - bounds.left);
  const height = Math.ceil(bounds.bottom - bounds.top);
  const content = cells.map((cell) => {
    const cellRect = cell.getBoundingClientRect();
    const x = Math.round(cellRect.left - bounds.left + 32);
    const y = Math.round(cellRect.top - bounds.top + 72);
    const text = (cell.innerText || cell.textContent || '').replace(/\s*\n\s*/g, ' · ').trim();
    const header = cell.tagName === 'TH';
    return `<rect x="${x}" y="${y}" width="${Math.round(cellRect.width)}" height="${Math.round(cellRect.height)}" fill="${header ? '#e4e7df' : '#f7f7f1'}" stroke="#c8ccc3" /><text x="${x + 9}" y="${y + 20}" fill="${header ? '#59645b' : '#263027'}" font-family="Arial, sans-serif" font-size="${header ? 11 : 14}" font-weight="${header ? 700 : 400}">${escapeXml(text)}</text>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width + 64}" height="${height + 104}" viewBox="0 0 ${width + 64} ${height + 104}"><rect width="100%" height="100%" fill="#ecebe3" /><text x="32" y="36" fill="#263027" font-family="Arial, sans-serif" font-size="22" font-weight="700">${escapeXml(title)}</text>${content}</svg>`;
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
    downloadBlob(png, `${safeFilename(filename)}.png`);
  } catch {
    downloadBlob(svgBlob, `${safeFilename(filename)}.svg`);
  }
}

function tableAfter(heading) {
  let element = heading.nextElementSibling;
  while (element && !/^H[1-3]$/.test(element.tagName)) {
    const table = element.matches('.protected-table-scroll') ? element.querySelector('table') : null;
    if (table) return table;
    element = element.nextElementSibling;
  }
  return null;
}

function addExportButton(container, label, onClick) {
  const button = document.createElement('button');
  button.className = 'protected-export-button';
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  container.append(button);
}

function addTableExport(table, label, title, filename, body = null) {
  const actions = document.createElement('div');
  actions.className = 'protected-export-actions';
  addExportButton(actions, label, () => exportTableImage(table, title, filename, body));
  table.closest('.protected-table-scroll')?.before(actions);
}

function putDetailAfterSummary(root) {
  const summaryHeading = [...root.querySelectorAll('h2')].find((heading) => heading.textContent?.startsWith('1.'));
  const detailHeading = [...root.querySelectorAll('h2')].find((heading) => heading.textContent?.startsWith('2.'));
  const summaryTable = summaryHeading && tableAfter(summaryHeading);
  const detailTable = detailHeading && tableAfter(detailHeading);
  const detailWrapper = detailTable?.closest('.protected-table-scroll');
  if (summaryTable && detailHeading && detailWrapper) summaryTable.closest('.protected-table-scroll')?.after(detailHeading, detailWrapper);
}

function headingWithText(root, text) {
  return [...root.querySelectorAll('h2, h3')].find((heading) => heading.textContent?.trim() === text);
}

function collectBlock(heading, stopAt = null) {
  const nodes = [heading];
  let node = heading.nextSibling;
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE && /^H[1-3]$/.test(node.tagName)) {
      if (!stopAt || stopAt(node)) break;
      if (node.tagName !== 'H3') break;
    }
    nodes.push(node);
    node = node.nextSibling;
  }
  return nodes;
}

function splitDetailSchedule(table) {
  const wrapper = table.closest('.protected-table-scroll');
  if (!wrapper || table.tBodies.length === 0) return [];

  const fragment = document.createDocumentFragment();
  const details = [];
  [...table.tBodies].forEach((body, index) => {
    const firstRow = body.rows[0];
    const cells = [...(firstRow?.cells ?? [])];
    const day = firstRow?.querySelector('th')?.textContent?.trim() || String(index + 1);
    const date = cells.find((cell) => cell.tagName === 'TD')?.textContent?.trim() || '';
    const cityCell = cells.filter((cell) => cell.tagName === 'TD')[1];
    const city = [...(cityCell?.childNodes ?? [])]
      .map((node) => (node.nodeName === 'BR' ? '\n' : node.textContent))
      .join('')
      .split('\n')
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' · ');
    const heading = document.createElement('h3');
    heading.textContent = `Day ${day}${date ? ` · ${date}` : ''}${city ? ` · ${city}` : ''}`;
    const dayTable = table.cloneNode(false);
    const dayHead = table.tHead.cloneNode(true);
    const dayBody = body.cloneNode(true);
    // The heading already names the day, date and stay, so drop those three columns.
    for (const row of [dayHead.rows[0], dayBody.rows[0]]) [...(row?.cells ?? [])].slice(0, 3).forEach((cell) => cell.remove());
    dayTable.classList.replace('schedule-table', 'day-schedule-table');
    dayTable.append(dayHead, dayBody);
    const dayWrapper = document.createElement('div');
    dayWrapper.className = 'protected-table-scroll';
    dayWrapper.append(dayTable);
    fragment.append(heading, dayWrapper);
    details.push({ day, table: dayTable, title: heading.textContent });
  });
  wrapper.replaceWith(fragment);
  return details;
}

// Paragraphs written as "[Day N] ..." hold per-city notes; show them under that day's table.
function placeDayNotes(root, days) {
  const lastNote = new Map();
  for (const note of [...root.querySelectorAll('p')]) {
    const match = note.textContent?.trim().match(/^\[Day (\d+)\]\s*/);
    const target = match && days.find(({ day }) => day === match[1]);
    if (!target) continue;
    const walker = document.createTreeWalker(note, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (/\[Day \d+\]/.test(node.textContent ?? '')) {
        node.textContent = node.textContent.replace(/\s*\[Day \d+\]\s*/, '');
        break;
      }
    }
    note.classList.add('day-note');
    (lastNote.get(target.day) ?? target.table.closest('.protected-table-scroll')).after(note);
    lastNote.set(target.day, note);
  }
}

// "[예약 필요]" / "[예약 권장]" in bold mark rows that still need a booking; render them as colored badges.
function styleBookingTags(root) {
  for (const tag of root.querySelectorAll('.day-schedule-table strong')) {
    const match = tag.textContent?.trim().match(/^\[예약 (필요|권장)\]$/);
    if (!match) continue;
    tag.textContent = `예약 ${match[1]}`;
    tag.classList.add('booking-tag', match[1] === '필요' ? 'booking-required' : 'booking-recommended');
  }
}

function splitCityList(heading) {
  const table = tableAfter(heading);
  const wrapper = table?.closest('.protected-table-scroll');
  const headers = table ? [...table.querySelectorAll('thead th')].map((cell) => cell.textContent?.trim()) : [];
  if (!table || !wrapper || headers[0] !== '도시') return;

  const groups = new Map();
  for (const row of table.querySelectorAll('tbody tr')) {
    const city = row.cells[0]?.textContent?.trim();
    if (!city) continue;
    if (!groups.has(city)) groups.set(city, []);
    groups.get(city).push(row);
  }

  const fragment = document.createDocumentFragment();
  for (const [city, rows] of [...groups].sort(([left], [right]) => cityPosition(left) - cityPosition(right))) {
    const cityHeading = document.createElement('h3');
    cityHeading.textContent = city;
    const cityTable = table.cloneNode(false);
    const head = table.tHead.cloneNode(true);
    for (const row of head.rows) row.cells[0]?.remove();
    const body = document.createElement('tbody');
    for (const row of rows) {
      const clone = row.cloneNode(true);
      clone.cells[0]?.remove();
      body.append(clone);
    }
    cityTable.append(head, body);
    const cityWrapper = document.createElement('div');
    cityWrapper.className = 'protected-table-scroll';
    cityWrapper.append(cityTable);
    fragment.append(cityHeading, cityWrapper);
  }
  wrapper.replaceWith(fragment);
}

const CITY_ORDER = ['Helsinki', 'Madrid', 'Porto', 'Lisbon', 'Sevilla', 'Granada', 'Barcelona'];

function cityPosition(city) {
  const position = CITY_ORDER.findIndex((name) => city.includes(name));
  return position === -1 ? CITY_ORDER.length : position;
}

function isCityHeading(element) {
  return cityPosition(element.textContent ?? '') !== CITY_ORDER.length;
}

function orderCityTables(heading) {
  const cityBlocks = [];
  let element = heading.nextElementSibling;
  while (element && element.tagName !== 'H2') {
    if (element.tagName !== 'H3' || !isCityHeading(element)) {
      element = element.nextElementSibling;
      continue;
    }
    const nodes = collectBlock(element);
    cityBlocks.push({ city: element.textContent ?? '', nodes });
    element = nodes.at(-1)?.nextElementSibling ?? null;
  }
  if (!cityBlocks.length) return;
  const marker = document.createComment('city-order');
  cityBlocks[0].nodes[0].before(marker);
  marker.after(...cityBlocks.sort((left, right) => cityPosition(left.city) - cityPosition(right.city)).flatMap((block) => block.nodes));
  marker.remove();
}

function sortRowsByCity(table) {
  const headers = [...(table.tHead?.rows[0]?.cells ?? [])].map((cell) => cell.textContent?.trim());
  if (headers[0] !== '도시' || !table.tBodies[0]) return;
  const body = table.tBodies[0];
  const rows = [...body.rows];
  rows.sort((left, right) => cityPosition(left.cells[0]?.textContent ?? '') - cityPosition(right.cells[0]?.textContent ?? ''));
  body.append(...rows);
}

function cityTableEntries(heading) {
  const entries = [];
  let element = heading.nextElementSibling;
  while (element && element.tagName !== 'H2') {
    if (element.tagName === 'H3') {
      if (!isCityHeading(element)) break;
      const table = tableAfter(element);
      if (table) entries.push({ city: element.textContent?.trim() ?? '', table });
    }
    element = element.nextElementSibling;
  }
  return entries;
}

function moveMemoRowsOutside(heading, nameHeader) {
  for (const { city, table } of cityTableEntries(heading)) {
    const headers = [...table.querySelectorAll('thead th')].map((cell) => cell.textContent?.trim());
    const nameIndex = headers.indexOf(nameHeader);
    const remarkIndex = headers.indexOf('비고');
    if (nameIndex === -1 || remarkIndex === -1) continue;

    const notes = [];
    for (const row of [...table.querySelectorAll('tbody tr')]) {
      const name = row.cells[nameIndex]?.textContent?.trim();
      const remark = row.cells[remarkIndex]?.textContent?.trim();
      if (!name?.includes('메모')) continue;
      if (remark && remark !== '—') notes.push({ name, remark });
      row.remove();
    }
    if (!notes.length) continue;

    const section = document.createElement('section');
    section.className = 'protected-city-notes';
    const title = document.createElement('h4');
    title.textContent = `${city} 공통 메모`;
    const list = document.createElement('ul');
    for (const { remark } of notes) {
      const bullets = remark.split(/(?<=[.!?])\s+/u).filter(Boolean);
      for (const bullet of bullets) {
        const item = document.createElement('li');
        item.textContent = bullet;
        list.append(item);
      }
    }
    section.append(title, list);
    table.closest('.protected-table-scroll')?.after(section);
  }
}

function addProtectedExports() {
  const root = protectedContent.querySelector('section') ?? protectedContent;
  putDetailAfterSummary(root);
  const headings = [...root.querySelectorAll('h2')];
  const summary = headings.find((heading) => heading.textContent?.startsWith('1.'));
  const detail = headings.find((heading) => heading.textContent?.startsWith('2.'));
  const transport = headings.find((heading) => heading.textContent?.startsWith('3.'));
  const tours = headings.find((heading) => heading.textContent?.startsWith('4.'));
  const restaurant = headings.find((heading) => heading.textContent?.startsWith('5.'));
  const attractions = headings.find((heading) => heading.textContent?.startsWith('6.'));
  const summaryTable = summary && tableAfter(summary);
  const detailTable = detail && tableAfter(detail);

  if (summaryTable) addTableExport(summaryTable, '16일 요약 이미지 저장', '16일 요약 일정', 'iberian-passage-2026-summary');
  if (detailTable) {
    const days = splitDetailSchedule(detailTable);
    days.forEach(({ day, table, title }) => {
      addTableExport(table, `Day ${day} 이미지 저장`, title, `iberian-passage-2026-day-${day}`);
    });
    placeDayNotes(root, days);
    styleBookingTags(root);
  }
  if (restaurant) {
    splitCityList(restaurant);
    orderCityTables(restaurant);
    moveMemoRowsOutside(restaurant, '식당');
  }
  if (attractions) orderCityTables(attractions);
  if (tours) {
    const tourTable = tableAfter(tours);
    if (tourTable) sortRowsByCity(tourTable);
  }

  if (transport) {
    let element = transport.nextElementSibling;
    while (element && element.tagName !== 'H2') {
      if (element.tagName === 'H3') {
        const table = tableAfter(element);
        if (table) addTableExport(table, '이동 시간표 이미지 저장', element.textContent ?? '이동 시간표', `iberian-passage-2026-${element.textContent ?? 'transport'}`);
        collapseBookedTimetable(element);
      }
      element = element.nextElementSibling;
    }
  }

  collapseSections(root);
  addTableOfContents(root);
}

function collapseSections(root) {
  for (const heading of [...root.querySelectorAll('h2')]) {
    const nodes = [];
    let node = heading.nextSibling;
    while (node && !(node.nodeType === Node.ELEMENT_NODE && /^H[12]$/.test(node.tagName))) {
      nodes.push(node);
      node = node.nextSibling;
    }
    const details = document.createElement('details');
    details.className = 'protected-section';
    const summary = document.createElement('summary');
    heading.replaceWith(details);
    summary.append(heading);
    details.append(summary, ...nodes);
  }
}

function setAllSections(root, open) {
  for (const details of root.querySelectorAll('details.protected-section')) details.open = open;
}

function openSectionFor(target) {
  const details = target?.closest('details.protected-section');
  if (details) details.open = true;
}

function bookedSummaryParagraph(heading) {
  let element = heading.nextElementSibling;
  while (element && !/^H[1-3]$/.test(element.tagName)) {
    if (element.tagName === 'P' && /^예약 완료\s*:/.test(element.textContent?.trim() ?? '')) return element;
    element = element.nextElementSibling;
  }
  return null;
}

function collapseBookedTimetable(heading) {
  const booked = bookedSummaryParagraph(heading);
  if (!booked) return;

  const nodes = [];
  let node = booked.nextSibling;
  while (node && !(node.nodeType === Node.ELEMENT_NODE && /^H[1-3]$/.test(node.tagName))) {
    nodes.push(node);
    node = node.nextSibling;
  }
  if (!nodes.some((item) => item.nodeType === Node.ELEMENT_NODE && item.querySelector?.('table'))) return;

  const details = document.createElement('details');
  details.className = 'protected-collapsible';
  const summary = document.createElement('summary');
  summary.textContent = '해당 날짜 전체 시간표 보기';
  details.append(summary, ...nodes);
  booked.after(details);
}

function addTableOfContents(root) {
  const headings = [...root.querySelectorAll('h2')];
  if (headings.length < 2) return;

  const nav = document.createElement('nav');
  nav.className = 'protected-toc';
  nav.setAttribute('aria-label', '세부 일정 목차');
  const title = document.createElement('p');
  title.textContent = '목차';
  const list = document.createElement('ol');

  headings.forEach((heading, index) => {
    const id = `protected-section-${index + 1}`;
    const target = heading.closest('details.protected-section') ?? heading;
    target.id = id;
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${id}`;
    link.textContent = heading.textContent?.trim() ?? `섹션 ${index + 1}`;
    link.addEventListener('click', () => openSectionFor(target));
    item.append(link);
    list.append(item);
  });

  const actions = document.createElement('div');
  actions.className = 'protected-toc-actions';
  addExportButton(actions, '모두 펼치기', () => setAllSections(root, true));
  addExportButton(actions, '모두 접기', () => setAllSections(root, false));

  nav.append(title, list, actions);
  const anchor = root.querySelector('h1');
  if (anchor) anchor.after(nav);
  else root.prepend(nav);

  window.addEventListener('hashchange', () => {
    const target = root.querySelector(`#${CSS.escape(location.hash.slice(1))}`);
    if (target) openSectionFor(target);
  });
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

  try {
    const payload = await loadPayload();
    const plaintext = await decryptPayload(payload, passphrase);

    const content = plaintext.trimStart().startsWith('<') ? renderHtml(plaintext) : renderMarkdown(plaintext);
    protectedContent.replaceChildren(content);
    addProtectedExports();
    protectedContent.hidden = false;
    status.textContent = '보호된 계획을 열었습니다. 이 브라우저에 비밀 구문을 저장하지 않습니다.';
  } catch {
    status.textContent = '비밀 구문이 맞지 않거나, 보호된 계획이 아직 준비되지 않았습니다.';
  } finally {
    passphraseInput.value = '';
    submitButton.disabled = false;
  }
});
