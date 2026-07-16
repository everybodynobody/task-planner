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

function normalizeClientNames(values) {
  const unique = [];
  (values || []).forEach((value) => {
    const name = String(value || '').trim();
    if (!name) return;
    if (!unique.includes(name)) {
      unique.push(name);
    }
  });
  return unique;
}

async function fetchAllClients(config) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/clients?select=name&order=name.asc`, {
    method: 'GET',
    headers: {
      apikey: config.secretKey,
      Authorization: `Bearer ${config.secretKey}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Errore lettura clients');
  }

  const rows = await response.json();
  return normalizeClientNames(rows.map((row) => row.name));
}

async function upsertClients(config, names) {
  const payload = normalizeClientNames(names).map((name) => ({ name }));
  if (!payload.length) {
    return fetchAllClients(config);
  }

  const response = await fetch(`${config.supabaseUrl}/rest/v1/clients?on_conflict=name`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.secretKey,
      Authorization: `Bearer ${config.secretKey}`,
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Errore salvataggio clients');
  }

  return fetchAllClients(config);
}

export default async function handler(req, res) {
  const config = getSupabaseConfig();
  if (!config) {
    res.status(500).json({ error: 'Supabase env vars mancanti.' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const clients = await fetchAllClients(config);
      res.status(200).json({ clients });
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const names = Array.isArray(body.names)
        ? body.names
        : (body.name ? [body.name] : []);

      const clients = await upsertClients(config, names);
      res.status(200).json({ clients });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Metodo non supportato.' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Errore server.' });
  }
}
