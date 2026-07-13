const STORAGE_KEY = 'starwars-todo-list';
const CLIENTS_STORAGE_KEY = 'starwars-clients';
const taskInput = document.getElementById('taskInput');
const descriptionInput = document.getElementById('descriptionInput');
const reminderInput = document.getElementById('reminderInput');
const dueDateInput = document.getElementById('dueDateInput');
const priorityInput = document.getElementById('priorityInput');
const typeInput = document.getElementById('typeInput');
const clientField = document.getElementById('clientField');
const assigneeField = document.getElementById('assigneeField');
const clientSectionTitle = document.getElementById('clientSectionTitle');
const clientAddDivider = document.getElementById('clientAddDivider');
const clientAddBox = document.getElementById('clientAddBox');
const clientSelect = document.getElementById('clientSelect');
const assigneeInput = document.getElementById('assigneeInput');
const clientNameInput = document.getElementById('clientNameInput');
const addClientButton = document.getElementById('addClientButton');
const exportClientsCsvButton = document.getElementById('exportClientsCsvButton');
const importClientsCsvButton = document.getElementById('importClientsCsvButton');
const importClientsCsvInput = document.getElementById('importClientsCsvInput');
const addButton = document.getElementById('addButton');
const clearFieldsButton = document.getElementById('clearFieldsButton');
const cancelEditButton = document.getElementById('cancelEditButton');
const taskList = document.getElementById('taskList');
const searchInput = document.getElementById('searchInput');
const filterButtons = Array.from(document.querySelectorAll('.filter'));
const sortSelect = document.getElementById('sortSelect');
const clearCompletedButton = document.getElementById('clearCompletedButton');
const exportButton = document.getElementById('exportButton');
const importButton = document.getElementById('importButton');
const importInput = document.getElementById('importInput');
const reportTotalTime = document.getElementById('reportTotalTime');
const reportTrackedTasks = document.getElementById('reportTrackedTasks');
const reportByClient = document.getElementById('reportByClient');
const reportClientFilterInput = document.getElementById('reportClientFilter');
const reportDateFromFilterInput = document.getElementById('reportDateFromFilter');
const reportDateToFilterInput = document.getElementById('reportDateToFilter');
const reportClearFiltersButton = document.getElementById('reportClearFiltersButton');
const reportExportCsvButton = document.getElementById('reportExportCsvButton');
const reportExportXlsxButton = document.getElementById('reportExportXlsxButton');
const overviewTotal = document.getElementById('overviewTotal');
const overviewCompleted = document.getElementById('overviewCompleted');
const overviewUrgent = document.getElementById('overviewUrgent');
const overviewWarning = document.getElementById('overviewWarning');
const overviewPending = document.getElementById('overviewPending');
const appTabs = Array.from(document.querySelectorAll('.app-tab'));
const panels = Array.from(document.querySelectorAll('.panel'));

let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').map(normalizeTask);
let clients = JSON.parse(localStorage.getItem(CLIENTS_STORAGE_KEY) || '[]').filter(Boolean);
let currentFilter = 'all';
let searchTerm = '';
let sortMode = 'due';
let editingId = null;
let reportClientFilter = 'all';
let reportDateFromFilter = '';
let reportDateToFilter = '';

function normalizeTask(task) {
  const description = task.description || '';
  const subtasks = Array.isArray(task.subtasks)
    ? task.subtasks.map((subtask, index) => ({
        id: subtask.id || `${task.id || Date.now()}-sub-${index}`,
        text: String(subtask.text || '').trim(),
        done: Boolean(subtask.done),
      })).filter((subtask) => subtask.text)
    : parseSubtasksFromDescription(description);

  return {
    id: task.id || String(Date.now()),
    text: task.text || '',
    description,
    subtasks,
    done: Boolean(task.done),
    trackedMs: Number(task.trackedMs) || 0,
    timerStartedAt: task.timerStartedAt ? String(task.timerStartedAt) : null,
    reminder: task.reminder || null,
    dueDate: task.dueDate || null,
    priority: task.priority || 'medium',
    type: task.type || 'personale',
    clientName: task.clientName || '',
    assignee: task.assignee || '',
    createdAt: task.createdAt || task.id || String(Date.now()),
  };
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function getTrackedTimeMs(task) {
  const base = Number(task.trackedMs) || 0;
  if (!task.timerStartedAt) return base;

  const startedAt = Number(task.timerStartedAt);
  if (!startedAt) return base;

  return base + Math.max(0, Date.now() - startedAt);
}

function formatDuration(ms) {
  const safeMs = Math.max(0, Number(ms) || 0);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatReportDate(value) {
  if (!value) return 'Data non disponibile';

  const normalizedValue = typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : value;
  const reportDate = new Date(normalizedValue);
  if (Number.isNaN(reportDate.getTime())) return 'Data non disponibile';

  return reportDate.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function parseReportDateValue(value) {
  if (!value) return null;

  const normalizedValue = typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : value;
  const reportDate = new Date(normalizedValue);
  if (Number.isNaN(reportDate.getTime())) return null;
  return reportDate;
}

function getStartOfLocalDay(dateValue) {
  if (!dateValue) return null;
  const start = new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(start.getTime()) ? null : start;
}

function getEndOfLocalDay(dateValue) {
  if (!dateValue) return null;
  const end = new Date(`${dateValue}T23:59:59.999`);
  return Number.isNaN(end.getTime()) ? null : end;
}

function getTimeReportEntries() {
  return tasks
    .map((task) => ({
      id: task.id,
      date: task.createdAt,
      taskName: task.text || 'Missione senza titolo',
      clientName: getTaskClientLabel(task),
      trackedMs: getTrackedTimeMs(task),
      running: Boolean(task.timerStartedAt),
    }))
    .filter((entry) => entry.trackedMs > 0 || entry.running);
}

function applyTimeReportFilters(entries) {
  const startDate = getStartOfLocalDay(reportDateFromFilter);
  const endDate = getEndOfLocalDay(reportDateToFilter);

  return entries.filter((entry) => {
    if (reportClientFilter !== 'all' && entry.clientName !== reportClientFilter) {
      return false;
    }

    if (!startDate && !endDate) {
      return true;
    }

    const entryDate = parseReportDateValue(entry.date);
    if (!entryDate) return false;
    if (startDate && entryDate < startDate) return false;
    if (endDate && entryDate > endDate) return false;
    return true;
  });
}

function getFilteredTimeReportEntries() {
  return applyTimeReportFilters(getTimeReportEntries());
}

function renderReportClientFilterOptions() {
  const availableClients = Array.from(new Set(getTimeReportEntries().map((entry) => entry.clientName)))
    .sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));

  reportClientFilterInput.innerHTML = '';

  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'Tutti i clienti';
  reportClientFilterInput.appendChild(allOption);

  availableClients.forEach((clientName) => {
    const option = document.createElement('option');
    option.value = clientName;
    option.textContent = clientName;
    reportClientFilterInput.appendChild(option);
  });

  if (reportClientFilter !== 'all' && !availableClients.includes(reportClientFilter)) {
    reportClientFilter = 'all';
  }

  reportClientFilterInput.value = reportClientFilter;
}

function sortTimeReportEntries(entries) {
  return entries.slice().sort((a, b) => {
    const clientCompare = a.clientName.localeCompare(b.clientName, 'it', { sensitivity: 'base' });
    if (clientCompare !== 0) return clientCompare;
    if (b.trackedMs !== a.trackedMs) return b.trackedMs - a.trackedMs;
    return a.taskName.localeCompare(b.taskName, 'it', { sensitivity: 'base' });
  });
}

function escapeCsvValue(value) {
  const text = String(value ?? '');
  if (/[";\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildReportCsv(entries) {
  const lines = [
    ['Cliente', 'Task', 'Data', 'Tempo dedicato', 'Stato'].map(escapeCsvValue).join(';'),
  ];

  entries.forEach((entry) => {
    lines.push([
      entry.clientName,
      entry.taskName,
      formatReportDate(entry.date),
      formatDuration(entry.trackedMs),
      entry.running ? 'In corso' : 'Completato',
    ].map(escapeCsvValue).join(';'));
  });

  return `\uFEFF${lines.join('\r\n')}`;
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnLetter(index) {
  let value = index;
  let letters = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters;
}

function utf8Bytes(value) {
  return new TextEncoder().encode(String(value));
}

const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[index] = crc >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = crc32Table[(crc ^ bytes[index]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function dateToDos(date) {
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const year = Math.max(1980, safeDate.getFullYear());
  return {
    time: ((safeDate.getHours() & 0x1F) << 11) | ((safeDate.getMinutes() & 0x3F) << 5) | Math.floor(safeDate.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((safeDate.getMonth() + 1) << 5) | safeDate.getDate(),
  };
}

function createZipBlob(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach(({ name, content }) => {
    const nameBytes = utf8Bytes(name);
    const dataBytes = utf8Bytes(content);
    const crc = crc32(dataBytes);
    const dos = dateToDos(new Date());

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034B50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, dos.time, true);
    localView.setUint16(12, dos.date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, dataBytes.length, true);
    localView.setUint32(22, dataBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014B50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dos.time, true);
    centralView.setUint16(14, dos.date, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, dataBytes.length, true);
    centralView.setUint32(24, dataBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const localSize = localParts.reduce((sum, part) => sum + part.length, 0);

  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054B50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, localSize, true);
  endView.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, endRecord], { type: 'application/zip' });
}

function buildReportXlsxWorkbook(entries) {
  const rows = [
    ['Cliente', 'Task', 'Data', 'Tempo dedicato', 'Stato'],
    ...entries.map((entry) => [
      entry.clientName,
      entry.taskName,
      formatReportDate(entry.date),
      formatDuration(entry.trackedMs),
      entry.running ? 'In corso' : 'Completato',
    ]),
  ];

  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((cell, cellIndex) => {
      const reference = `${columnLetter(cellIndex + 1)}${rowIndex + 1}`;
      return `<c r="${reference}" t="inlineStr"><is><t>${xmlEscape(cell)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');

  const dimension = `A1:${columnLetter(rows[0].length)}${rows.length}`;

  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="${dimension}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Report Tempi" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/_rels/.rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  return createZipBlob([
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: rootRels },
    { name: 'xl/workbook.xml', content: workbook },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRels },
    { name: 'xl/worksheets/sheet1.xml', content: worksheet },
  ]);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadTimeReportCsv() {
  const entries = sortTimeReportEntries(getFilteredTimeReportEntries());
  downloadBlob(new Blob([buildReportCsv(entries)], { type: 'text/csv;charset=utf-8' }), 'report-tempi.csv');
}

function downloadTimeReportXlsx() {
  const entries = sortTimeReportEntries(getFilteredTimeReportEntries());
  downloadBlob(buildReportXlsxWorkbook(entries), 'report-tempi.xlsx');
}

function stopTaskTimer(taskId) {
  const now = Date.now();
  tasks = tasks.map((task) => {
    if (task.id !== taskId || !task.timerStartedAt) return task;
    const elapsed = Math.max(0, now - Number(task.timerStartedAt));
    return {
      ...task,
      trackedMs: (Number(task.trackedMs) || 0) + elapsed,
      timerStartedAt: null,
    };
  });
  saveTasks();
  renderTasks();
}

function startTaskTimer(taskId) {
  const now = Date.now();
  tasks = tasks.map((task) => {
    if (task.id === taskId) {
      if (task.done || task.timerStartedAt) return task;
      return {
        ...task,
        timerStartedAt: String(now),
      };
    }

    // Keep one active timer at a time to avoid overlapping work logs.
    if (task.timerStartedAt) {
      const elapsed = Math.max(0, now - Number(task.timerStartedAt));
      return {
        ...task,
        trackedMs: (Number(task.trackedMs) || 0) + elapsed,
        timerStartedAt: null,
      };
    }

    return task;
  });
  saveTasks();
  renderTasks();
}

function toggleTaskTimer(taskId) {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task) return;
  if (task.timerStartedAt) {
    stopTaskTimer(taskId);
  } else {
    startTaskTimer(taskId);
  }
}

function parseSubtasksFromDescription(description, currentSubtasks = []) {
  if (!description || !description.includes(',')) return [];

  const parts = description
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const used = new Set();
  return parts.map((text, index) => {
    const previousIndex = currentSubtasks.findIndex((subtask, candidateIndex) => (
      !used.has(candidateIndex) && subtask.text.toLowerCase() === text.toLowerCase()
    ));

    if (previousIndex >= 0) {
      used.add(previousIndex);
      const previous = currentSubtasks[previousIndex];
      return {
        id: previous.id || `${Date.now()}-sub-${index}`,
        text,
        done: Boolean(previous.done),
      };
    }

    return {
      id: `${Date.now()}-sub-${index}`,
      text,
      done: false,
    };
  });
}

function formatReminder(value) {
  if (!value) return '';

  const reminderDate = new Date(value);
  if (Number.isNaN(reminderDate.getTime())) return '';

  return reminderDate.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isDatePassed(value) {
  if (!value) return false;

  const targetDate = new Date(value);
  if (Number.isNaN(targetDate.getTime())) return false;

  return targetDate <= new Date();
}

function isTaskExpired(task) {
  if (!task.dueDate || task.done) return false;

  const dueDate = new Date(task.dueDate);
  if (Number.isNaN(dueDate.getTime())) return false;

  const now = new Date();
  return dueDate <= now;
}

function isTaskDueSoon(task) {
  if (!task.dueDate || task.done) return false;

  const dueDate = new Date(task.dueDate);
  if (Number.isNaN(dueDate.getTime())) return false;

  const now = new Date();
  const twoHours = 2 * 60 * 60 * 1000;
  return dueDate > now && dueDate - now <= twoHours;
}

function getTaskStatus(task) {
  if (task.done) return 'completed';
  if (isTaskExpired(task)) return 'urgent';
  if (isTaskDueSoon(task)) return 'warning';
  return 'pending';
}

function getPriorityWeight(priority) {
  switch (priority) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    default:
      return 1;
  }
}

function getVisibleTasks() {
  let visible = tasks.filter((task) => {
    const matchesSearch = task.text.toLowerCase().includes(searchTerm.toLowerCase());
    const status = getTaskStatus(task);

    let matchesFilter = true;
    if (currentFilter === 'pending') {
      matchesFilter = status === 'pending';
    } else if (currentFilter === 'warning') {
      matchesFilter = status === 'warning';
    } else if (currentFilter === 'urgent') {
      matchesFilter = status === 'urgent';
    } else if (currentFilter === 'completed') {
      matchesFilter = status === 'completed';
    }

    return matchesSearch && matchesFilter;
  });

  switch (sortMode) {
    case 'oldest':
      visible = visible.sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
      break;
    case 'priority':
      visible = visible.sort((a, b) => getPriorityWeight(b.priority) - getPriorityWeight(a.priority) || Number(b.createdAt) - Number(a.createdAt));
      break;
    case 'due':
      visible = visible.sort((a, b) => {
        if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return Number(b.createdAt) - Number(a.createdAt);
      });
      break;
    default:
      visible = visible.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
      break;
  }

  return visible;
}

function getTaskClientLabel(task) {
  if (task.type === 'cliente') {
    return task.clientName || 'Cliente non assegnato';
  }
  return 'Personale';
}

function renderTimeReport() {
  renderReportClientFilterOptions();
  const reportEntries = getFilteredTimeReportEntries();

  const totalMs = reportEntries.reduce((sum, entry) => sum + entry.trackedMs, 0);
  reportTotalTime.textContent = formatDuration(totalMs);
  reportTrackedTasks.textContent = String(reportEntries.length);

  reportByClient.innerHTML = '';

  if (reportEntries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    const hasActiveFilters = reportClientFilter !== 'all' || Boolean(reportDateFromFilter) || Boolean(reportDateToFilter);
    empty.textContent = hasActiveFilters
      ? 'Nessun risultato con i filtri attivi.'
      : 'Nessun tempo registrato finora.';
    reportByClient.appendChild(empty);
    return;
  }

  const grouped = reportEntries.reduce((acc, entry) => {
    if (!acc[entry.clientName]) {
      acc[entry.clientName] = {
        totalMs: 0,
        tasks: [],
      };
    }
    acc[entry.clientName].totalMs += entry.trackedMs;
    acc[entry.clientName].tasks.push(entry);
    return acc;
  }, {});

  const sortedClientNames = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));

  sortedClientNames.forEach((clientName) => {
    const group = grouped[clientName];
    group.tasks.sort((a, b) => b.trackedMs - a.trackedMs);

    const groupNode = document.createElement('article');
    groupNode.className = 'report-group';

    const header = document.createElement('div');
    header.className = 'report-group-header';

    const title = document.createElement('div');
    title.className = 'report-group-title';
    title.textContent = clientName;

    const total = document.createElement('div');
    total.className = 'report-group-time';
    total.textContent = formatDuration(group.totalMs);

    header.appendChild(title);
    header.appendChild(total);
    groupNode.appendChild(header);

    group.tasks.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'report-task-row';

      const info = document.createElement('div');
      info.className = 'report-task-info';

      const name = document.createElement('div');
      name.className = 'report-task-name';
      name.textContent = entry.taskName;

      const date = document.createElement('div');
      date.className = 'report-task-date';
      date.textContent = formatReportDate(entry.date);

      info.appendChild(name);
      info.appendChild(date);

      const time = document.createElement('div');
      time.className = 'report-task-time';
      time.textContent = `${formatDuration(entry.trackedMs)}${entry.running ? ' • IN CORSO' : ''}`;

      row.appendChild(info);
      row.appendChild(time);
      groupNode.appendChild(row);
    });

    reportByClient.appendChild(groupNode);
  });
}

function renderTaskOverview() {
  const counts = tasks.reduce((acc, task) => {
    if (task.done) {
      acc.completed += 1;
      return acc;
    }

    const status = getTaskStatus(task);
    if (status === 'urgent') {
      acc.urgent += 1;
    } else if (status === 'warning') {
      acc.warning += 1;
    } else {
      acc.pending += 1;
    }

    return acc;
  }, {
    completed: 0,
    urgent: 0,
    warning: 0,
    pending: 0,
  });

  const total = counts.completed + counts.urgent + counts.warning + counts.pending;

  overviewTotal.textContent = String(total);
  overviewCompleted.textContent = String(counts.completed);
  overviewUrgent.textContent = String(counts.urgent);
  overviewWarning.textContent = String(counts.warning);
  overviewPending.textContent = String(counts.pending);
}

function saveClients() {
  localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
}

function renderClientOptions(selectedName = '') {
  clientSelect.innerHTML = '';

  const sortedClients = [...clients].sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));

  if (!sortedClients.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Nessun cliente salvato';
    clientSelect.appendChild(option);
    clientSelect.disabled = true;
    return;
  }

  clientSelect.disabled = false;
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Seleziona cliente';
  clientSelect.appendChild(placeholder);

  sortedClients.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    clientSelect.appendChild(option);
  });

  if (selectedName && sortedClients.includes(selectedName)) {
    clientSelect.value = selectedName;
  }
}

function addClient() {
  const name = clientNameInput.value.trim();
  if (!name) return;

  if (!clients.includes(name)) {
    clients.push(name);
    saveClients();
  }

  clientNameInput.value = '';
  renderClientOptions(name);
  if (typeInput.value === 'cliente') {
    clientSelect.value = name;
  }
}

function normalizeClientNameList(values) {
  const unique = [];
  values.forEach((value) => {
    const name = String(value || '').trim();
    if (!name) return;
    if (!unique.includes(name)) {
      unique.push(name);
    }
  });
  return unique;
}

function exportClientsCsv() {
  const normalized = normalizeClientNameList(clients).sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
  const csv = `\uFEFF${normalized.join(',')}`;
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'clienti.csv');
}

function parseClientsCsv(csvText) {
  return normalizeClientNameList(String(csvText || '').split(/[,\n\r]+/g));
}

function importClientsCsvFromText(csvText) {
  const importedNames = parseClientsCsv(csvText);
  if (!importedNames.length) {
    window.alert('CSV clienti non valido o vuoto.');
    return;
  }

  clients = normalizeClientNameList([...clients, ...importedNames]);
  saveClients();
  renderClientOptions(clientSelect.value || '');
  if (typeInput.value === 'cliente') {
    clientSelect.disabled = false;
  }
}

function updateClientFieldVisibility() {
  const isClient = typeInput.value === 'cliente';
  clientField.hidden = !isClient;
  assigneeField.hidden = !isClient;
  clientSectionTitle.hidden = !isClient;
  clientAddDivider.hidden = !isClient;
  clientAddBox.hidden = !isClient;
}

function saveCurrentTask() {
  const text = taskInput.value.trim();
  if (!text) return;

  const description = descriptionInput.value.trim();
  const reminderValue = reminderInput.value || null;
  const dueDateValue = dueDateInput.value || null;
  const priorityValue = priorityInput.value || 'medium';
  const typeValue = typeInput.value || 'personale';
  const clientNameValue = typeValue === 'cliente' ? clientSelect.value || '' : '';
  const assigneeValue = typeValue === 'cliente' ? assigneeInput.value.trim() : '';
  const subtasksValue = parseSubtasksFromDescription(description);

  if (editingId) {
    const confirmed = window.confirm('Salvare le modifiche a questa missione?');
    if (!confirmed) return;

    tasks = tasks.map((task) => task.id === editingId
      ? {
          ...task,
          text,
          description,
          subtasks: parseSubtasksFromDescription(description, task.subtasks || []),
          reminder: reminderValue,
          dueDate: dueDateValue,
          priority: priorityValue,
          type: typeValue,
          clientName: clientNameValue,
          assignee: assigneeValue,
        }
      : task);
  } else {
    tasks.unshift({
      id: Date.now().toString(),
      text,
      description,
      subtasks: subtasksValue,
      done: false,
      trackedMs: 0,
      timerStartedAt: null,
      reminder: reminderValue,
      dueDate: dueDateValue,
      priority: priorityValue,
      type: typeValue,
      clientName: clientNameValue,
      assignee: assigneeValue,
      createdAt: Date.now().toString(),
    });
  }

  saveTasks();
  cancelEditing();
  renderTasks();
  renderTimeReport();
  taskInput.focus();
}

function setActiveTab(tabName) {
  appTabs.forEach((tabButton) => {
    tabButton.classList.toggle('active', tabButton.dataset.tab === tabName);
  });

  panels.forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panel === tabName);
  });
}

function setEditingMode(task) {
  setActiveTab('create');
  editingId = task.id;
  taskInput.value = task.text;
  descriptionInput.value = task.description || '';
  reminderInput.value = task.reminder || '';
  dueDateInput.value = task.dueDate || '';
  priorityInput.value = task.priority || 'medium';
  typeInput.value = task.type || 'personale';
  assigneeInput.value = task.assignee || '';
  updateClientFieldVisibility();
  renderClientOptions(task.clientName || '');
  if (task.type === 'cliente' && task.clientName && !clients.includes(task.clientName)) {
    clients.push(task.clientName);
    saveClients();
    renderClientOptions(task.clientName);
  }
  addButton.textContent = 'Salva modifica';
  cancelEditButton.hidden = false;
  taskInput.focus();
}

function cancelEditing() {
  editingId = null;
  addButton.textContent = 'Aggiungi task';
  cancelEditButton.hidden = true;
  taskInput.value = '';
  descriptionInput.value = '';
  reminderInput.value = '';
  dueDateInput.value = '';
  priorityInput.value = 'medium';
  typeInput.value = 'personale';
  assigneeInput.value = '';
  updateClientFieldVisibility();
  renderClientOptions();
  renderTimeReport();
}

function clearFormFields() {
  cancelEditing();
  taskInput.focus();
}

function renderTasks() {
  renderTaskOverview();
  taskList.innerHTML = '';

  const visibleTasks = getVisibleTasks();
  if (visibleTasks.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'Nessuna missione corrisponde ai filtri attuali.';
    taskList.appendChild(empty);
    return;
  }

  visibleTasks.forEach((task) => {
    const status = getTaskStatus(task);
    const item = document.createElement('li');
    item.className = `item${task.done ? ' completed' : ''}${status === 'urgent' ? ' urgent' : ''}${status === 'warning' ? ' warning' : ''}`;
    item.addEventListener('click', (event) => {
      if (event.target.closest('.actions') || event.target.closest('input[type="checkbox"]')) return;
      setEditingMode(task);
    });

    const main = document.createElement('div');
    main.className = 'item-main';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.done;
    checkbox.addEventListener('change', (event) => {
      event.stopPropagation();
      const now = Date.now();
      tasks = tasks.map((taskItem) => {
        if (taskItem.id !== task.id) return taskItem;
        if (checkbox.checked && taskItem.timerStartedAt) {
          const elapsed = Math.max(0, now - Number(taskItem.timerStartedAt));
          return {
            ...taskItem,
            done: true,
            trackedMs: (Number(taskItem.trackedMs) || 0) + elapsed,
            timerStartedAt: null,
          };
        }
        return {
          ...taskItem,
          done: checkbox.checked,
        };
      });
      saveTasks();
      renderTasks();
    });

    const content = document.createElement('div');
    content.className = 'task-content';

    const title = document.createElement('div');
    title.className = 'task-title';
    title.textContent = task.text;

    const meta = document.createElement('div');
    meta.className = 'task-meta';

    const priorityBadge = document.createElement('div');
    priorityBadge.className = `priority-pill ${task.priority || 'medium'}`;
    priorityBadge.textContent = task.priority === 'high'
      ? 'Alta'
      : task.priority === 'low'
        ? 'Bassa'
        : 'Media';

    const typeBadge = document.createElement('div');
    typeBadge.className = `type-pill ${task.type === 'cliente' ? 'cliente' : 'personale'}`;
    typeBadge.textContent = task.type === 'cliente'
      ? (task.clientName ? `Cliente • ${task.clientName}` : 'Cliente')
      : 'Personale';

    const reminderInfo = document.createElement('div');
    reminderInfo.className = 'reminder-info';
    reminderInfo.textContent = task.reminder
      ? `⏰ ${formatReminder(task.reminder)}`
      : '';
    if (isDatePassed(task.reminder)) {
      reminderInfo.classList.add('past');
    }

    const dueInfo = document.createElement('div');
    dueInfo.className = 'due-info';
    dueInfo.textContent = task.dueDate
      ? `📅 ${formatReminder(task.dueDate)}`
      : '';
    if (isDatePassed(task.dueDate)) {
      dueInfo.classList.add('past');
    }

    const assigneeInfo = document.createElement('div');
    assigneeInfo.className = 'assignee-info';
    assigneeInfo.textContent = task.assignee ? `👤 ${task.assignee}` : '';

    const timerInfo = document.createElement('div');
    timerInfo.className = `timer-info${task.timerStartedAt ? ' running' : ''}`;
    timerInfo.textContent = `⏱ ${formatDuration(getTrackedTimeMs(task))}${task.timerStartedAt ? ' • IN CORSO' : ''}`;

    const statusBadge = document.createElement('div');
    statusBadge.className = 'status-badge';

    if (task.done) {
      statusBadge.className += ' completed';
      statusBadge.textContent = 'COMPLETATO!';
    } else if (status === 'urgent') {
      statusBadge.className += ' urgent';
      statusBadge.textContent = 'SCADUTO!';
    } else if (status === 'warning') {
      statusBadge.className += ' warning';
      statusBadge.textContent = 'IN SCADENZA!';
    } else {
      statusBadge.className += ' pending';
      statusBadge.textContent = 'DA FARE!';
    }

    const actions = document.createElement('div');
    actions.className = 'actions';

    const editButton = document.createElement('button');
    editButton.textContent = 'Modifica';
    editButton.addEventListener('click', (event) => {
      event.stopPropagation();
      setEditingMode(task);
    });

    const timerButton = document.createElement('button');
    timerButton.className = 'timer';
    timerButton.textContent = task.timerStartedAt ? 'Stop timer' : 'Start timer';
    timerButton.disabled = task.done;
    timerButton.addEventListener('click', (event) => {
      event.stopPropagation();
      if (task.done) return;
      toggleTaskTimer(task.id);
    });

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete';
    deleteButton.textContent = 'Elimina';
    deleteButton.addEventListener('click', (event) => {
      event.stopPropagation();
      tasks = tasks.filter((t) => t.id !== task.id);
      saveTasks();
      renderTasks();
    });

    content.appendChild(title);

    meta.appendChild(priorityBadge);
    meta.appendChild(typeBadge);
    content.appendChild(meta);

    if (task.description) {
      if (Array.isArray(task.subtasks) && task.subtasks.length > 0) {
        const subtasksList = document.createElement('ul');
        subtasksList.className = 'subtasks';

        task.subtasks.forEach((subtask) => {
          const subtaskItem = document.createElement('li');
          subtaskItem.className = `subtask${subtask.done ? ' done' : ''}`;

          const subtaskCheckbox = document.createElement('input');
          subtaskCheckbox.type = 'checkbox';
          subtaskCheckbox.checked = Boolean(subtask.done);
          subtaskCheckbox.addEventListener('click', (event) => {
            event.stopPropagation();
          });
          subtaskCheckbox.addEventListener('change', (event) => {
            event.stopPropagation();
            tasks = tasks.map((taskItem) => taskItem.id === task.id
              ? {
                  ...taskItem,
                  subtasks: taskItem.subtasks.map((item) => item.id === subtask.id
                    ? { ...item, done: subtaskCheckbox.checked }
                    : item),
                }
              : taskItem);
            saveTasks();
            renderTasks();
          });

          const subtaskText = document.createElement('span');
          subtaskText.className = 'subtask-text';
          subtaskText.textContent = subtask.text;

          subtaskItem.appendChild(subtaskCheckbox);
          subtaskItem.appendChild(subtaskText);
          subtasksList.appendChild(subtaskItem);
        });

        content.appendChild(subtasksList);
      } else {
        const description = document.createElement('div');
        description.className = 'task-description';
        description.textContent = task.description;
        content.appendChild(description);
      }
    }

    if (task.reminder) {
      content.appendChild(reminderInfo);
    }
    if (task.dueDate) {
      content.appendChild(dueInfo);
    }
    if (task.assignee) {
      content.appendChild(assigneeInfo);
    }
    content.appendChild(timerInfo);
    content.appendChild(statusBadge);

    actions.appendChild(timerButton);
    actions.appendChild(editButton);
    actions.appendChild(deleteButton);

    main.appendChild(checkbox);
    main.appendChild(content);
    item.appendChild(main);
    item.appendChild(actions);
    taskList.appendChild(item);
  });

  renderTimeReport();
}

addButton.addEventListener('click', saveCurrentTask);
clearFieldsButton.addEventListener('click', clearFormFields);
cancelEditButton.addEventListener('click', cancelEditing);
addClientButton.addEventListener('click', addClient);

exportClientsCsvButton.addEventListener('click', exportClientsCsv);

importClientsCsvButton.addEventListener('click', () => importClientsCsvInput.click());

importClientsCsvInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      importClientsCsvFromText(reader.result);
    } finally {
      importClientsCsvInput.value = '';
    }
  };
  reader.readAsText(file);
});

appTabs.forEach((tabButton) => {
  tabButton.addEventListener('click', () => {
    setActiveTab(tabButton.dataset.tab || 'create');
  });
});

document.addEventListener('click', (event) => {
  const tabButton = event.target.closest('.app-tab');
  if (!tabButton) return;
  setActiveTab(tabButton.dataset.tab || 'create');
});

typeInput.addEventListener('change', () => {
  updateClientFieldVisibility();
  if (typeInput.value === 'cliente') {
    renderClientOptions(clientSelect.value || '');
  }
});

clientNameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    addClient();
  }
});

taskInput.addEventListener('keydown', (event) => {
  if (event.target === taskInput && event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    saveCurrentTask();
  }
});

searchInput.addEventListener('input', (event) => {
  searchTerm = event.target.value;
  renderTasks();
});

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    currentFilter = button.dataset.filter;
    filterButtons.forEach((btn) => btn.classList.toggle('active', btn === button));
    renderTasks();
  });
});

sortSelect.addEventListener('change', (event) => {
  sortMode = event.target.value;
  renderTasks();
});

clearCompletedButton.addEventListener('click', () => {
  tasks = tasks.filter((task) => !task.done);
  saveTasks();
  renderTasks();
});

reportExportCsvButton.addEventListener('click', downloadTimeReportCsv);

reportExportXlsxButton.addEventListener('click', downloadTimeReportXlsx);

reportClientFilterInput.addEventListener('change', (event) => {
  reportClientFilter = event.target.value || 'all';
  renderTimeReport();
});

reportDateFromFilterInput.addEventListener('change', (event) => {
  reportDateFromFilter = event.target.value || '';
  renderTimeReport();
});

reportDateToFilterInput.addEventListener('change', (event) => {
  reportDateToFilter = event.target.value || '';
  renderTimeReport();
});

reportClearFiltersButton.addEventListener('click', () => {
  reportClientFilter = 'all';
  reportDateFromFilter = '';
  reportDateToFilter = '';
  reportClientFilterInput.value = 'all';
  reportDateFromFilterInput.value = '';
  reportDateToFilterInput.value = '';
  renderTimeReport();
});

exportButton.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'starwars-todo-list.json');
});

importButton.addEventListener('click', () => importInput.click());

importInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (Array.isArray(imported)) {
        tasks = imported.map(normalizeTask);
        saveTasks();
        renderTasks();
      } else {
        window.alert('File non valido.');
      }
    } catch (error) {
      window.alert('File non valido.');
    } finally {
      importInput.value = '';
    }
  };
  reader.readAsText(file);
});

renderClientOptions();
updateClientFieldVisibility();
setActiveTab('create');
renderTasks();
renderTimeReport();

setInterval(() => {
  if (tasks.some((task) => (task.reminder && !task.done) || task.timerStartedAt)) {
    renderTasks();
    renderTimeReport();
  }
}, 1000);
