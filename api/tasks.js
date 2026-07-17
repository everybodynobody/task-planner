function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    return null;
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ''),
    secretKey,
  };
}

function getHeaders(secretKey, withJson = false) {
  const headers = {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
  };

  if (withJson) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function toIsoOrNull(value) {
  if (value === null || value === undefined || value === '') return null;

  const text = String(value).trim();
  if (!text) return null;

  const numeric = /^\d+$/.test(text) ? Number(text) : NaN;
  const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(text);

  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toDatetimeLocalOrNull(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toMsStringOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return String(date.getTime());
}

async function fetchJsonOrThrow(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Errore richiesta Supabase');
  }
  return response.json();
}

function normalizeSubtasks(rawSubtasks, taskId = null) {
  return (Array.isArray(rawSubtasks) ? rawSubtasks : [])
    .map((subtask, index) => ({
      id: isUuid(subtask?.id) ? String(subtask.id) : null,
      task_id: taskId || null,
      text: String(subtask?.text || '').trim(),
      done: Boolean(subtask?.done),
      position: Number.isFinite(Number(subtask?.position)) ? Number(subtask.position) : index,
    }))
    .filter((subtask) => subtask.text);
}

function mapTaskRowToClientTask(taskRow, taskSubtasks) {
  return {
    id: taskRow.id,
    text: taskRow.text || '',
    description: taskRow.description || '',
    subtasks: taskSubtasks.map((subtask) => ({
      id: subtask.id,
      text: subtask.text,
      done: Boolean(subtask.done),
    })),
    done: Boolean(taskRow.done),
    trackedMs: Number(taskRow.tracked_ms) || 0,
    timerStartedAt: toMsStringOrNull(taskRow.timer_started_at),
    reminder: toDatetimeLocalOrNull(taskRow.reminder),
    dueDate: toDatetimeLocalOrNull(taskRow.due_date),
    priority: taskRow.priority || 'medium',
    type: taskRow.type || 'personale',
    clientName: taskRow.client_name || '',
    assignee: taskRow.assignee || '',
    createdAt: toMsStringOrNull(taskRow.created_at) || String(Date.now()),
  };
}

async function fetchAllTasks(config) {
  const tasks = await fetchJsonOrThrow(
    `${config.supabaseUrl}/rest/v1/tasks?select=*&order=created_at.desc`,
    {
      method: 'GET',
      headers: getHeaders(config.secretKey),
    },
  );

  const subtasks = await fetchJsonOrThrow(
    `${config.supabaseUrl}/rest/v1/subtasks?select=id,task_id,text,done,position&order=position.asc`,
    {
      method: 'GET',
      headers: getHeaders(config.secretKey),
    },
  );

  const subtasksByTask = subtasks.reduce((acc, subtask) => {
    const taskId = subtask.task_id;
    if (!taskId) return acc;
    if (!acc[taskId]) acc[taskId] = [];
    acc[taskId].push(subtask);
    return acc;
  }, {});

  return tasks.map((task) => mapTaskRowToClientTask(task, subtasksByTask[task.id] || []));
}

async function createTask(config, rawTask) {
  const task = rawTask && typeof rawTask === 'object' ? rawTask : {};

  const taskInsert = {
    text: String(task.text || '').trim(),
    description: String(task.description || ''),
    done: Boolean(task.done),
    tracked_ms: Number(task.trackedMs) || 0,
    timer_started_at: toIsoOrNull(task.timerStartedAt),
    reminder: toIsoOrNull(task.reminder),
    due_date: toIsoOrNull(task.dueDate),
    priority: ['low', 'medium', 'high'].includes(task.priority) ? task.priority : 'medium',
    type: ['personale', 'cliente'].includes(task.type) ? task.type : 'personale',
    client_name: String(task.clientName || ''),
    assignee: String(task.assignee || ''),
    created_at: toIsoOrNull(task.createdAt) || new Date().toISOString(),
  };

  if (!taskInsert.text) {
    throw new Error('Il campo task text è obbligatorio.');
  }

  if (isUuid(task.id)) {
    taskInsert.id = String(task.id);
  }

  const insertedRows = await fetchJsonOrThrow(
    `${config.supabaseUrl}/rest/v1/tasks`,
    {
      method: 'POST',
      headers: {
        ...getHeaders(config.secretKey, true),
        Prefer: 'return=representation',
      },
      body: JSON.stringify(taskInsert),
    },
  );

  const insertedTask = Array.isArray(insertedRows) ? insertedRows[0] : null;
  if (!insertedTask?.id) {
    throw new Error('Task creato ma ID non restituito da Supabase.');
  }

  const subtasks = normalizeSubtasks(task.subtasks, insertedTask.id);

  if (subtasks.length) {
    await fetchJsonOrThrow(
      `${config.supabaseUrl}/rest/v1/subtasks`,
      {
        method: 'POST',
        headers: {
          ...getHeaders(config.secretKey, true),
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(subtasks),
      },
    );
  }

  return fetchAllTasks(config);
}

export default async function handler(req, res) {
  const config = getSupabaseConfig();
  if (!config) {
    res.status(500).json({ error: 'Supabase env vars mancanti.' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const tasks = await fetchAllTasks(config);
      res.status(200).json({ tasks });
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const taskPayload = body.task && typeof body.task === 'object' ? body.task : body;
      const tasks = await createTask(config, taskPayload);
      res.status(200).json({ tasks });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Metodo non supportato.' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Errore server.' });
  }
}
