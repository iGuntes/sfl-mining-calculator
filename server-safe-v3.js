const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;
const STATIC_DIR = process.env.STATIC_DIR || process.cwd();
const PRICES_URL = 'https://sfl.world/api/v1/prices';
const LAND_ID = process.env.LAND_ID || '114779';
const LAND_V11_URL = (id = LAND_ID) => `https://sfl.world/api/v1.1/land/${id}`;
const LAND_URL = (id = LAND_ID) => `https://sfl.world/api/v1/land/${id}`;

async function fetchText(url) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json,text/plain,*/*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
    }
  });
  const text = await res.text();
  return { res, text };
}

app.get('/proxy/health', (_req, res) => {
  res.json({
    ok: true,
    pricesUrl: PRICES_URL,
    landV11Url: LAND_V11_URL(),
    landUrl: LAND_URL(),
    authRequired: false,
    staticDir: STATIC_DIR
  });
});

app.get('/proxy/debug-prices', async (_req, res) => {
  try {
    const { res: upstream, text } = await fetchText(PRICES_URL);
    res.json({
      ok: upstream.ok,
      status: upstream.status,
      contentType: upstream.headers.get('content-type'),
      preview: text.slice(0, 1000)
    });
  } catch (error) {
    res.status(502).json({ ok: false, error: error.message });
  }
});

app.get('/proxy/sfl-prices', async (_req, res) => {
  try {
    const { res: upstream, text } = await fetchText(PRICES_URL);
    res.status(upstream.status);
    const type = upstream.headers.get('content-type');
    if (type) res.setHeader('content-type', type);
    res.setHeader('access-control-allow-origin', '*');
    res.send(text);
  } catch (error) {
    res.status(502).json({ error: 'Bad Gateway', message: error.message });
  }
});

app.get('/proxy/land-v11/:id?', async (req, res) => {
  const id = req.params.id || LAND_ID;
  try {
    const { res: upstream, text } = await fetchText(LAND_V11_URL(id));
    res.status(upstream.status);
    const type = upstream.headers.get('content-type');
    if (type) res.setHeader('content-type', type);
    res.setHeader('access-control-allow-origin', '*');
    res.send(text);
  } catch (error) {
    res.status(502).json({ error: 'Bad Gateway', message: error.message, landId: id });
  }
});

app.get('/proxy/land/:id?', async (req, res) => {
  const id = req.params.id || LAND_ID;
  try {
    const { res: upstream, text } = await fetchText(LAND_URL(id));
    res.status(upstream.status);
    const type = upstream.headers.get('content-type');
    if (type) res.setHeader('content-type', type);
    res.setHeader('access-control-allow-origin', '*');
    res.send(text);
  } catch (error) {
    res.status(502).json({ error: 'Bad Gateway', message: error.message, landId: id });
  }
});

app.get('/proxy/debug-land/:id?', async (req, res) => {
  const id = req.params.id || LAND_ID;
  try {
    const v11 = await fetchText(LAND_V11_URL(id));
    const land = await fetchText(LAND_URL(id));
    res.json({
      ok: true,
      landId: id,
      v11: {
        status: v11.res.status,
        contentType: v11.res.headers.get('content-type'),
        preview: v11.text.slice(0, 1000)
      },
      land: {
        status: land.res.status,
        contentType: land.res.headers.get('content-type'),
        preview: land.text.slice(0, 1000)
      }
    });
  } catch (error) {
    res.status(502).json({ ok: false, error: error.message, landId: id });
  }
});

app.use(express.static(STATIC_DIR));

app.get('*', (req, res) => {
  const file = req.path === '/' ? 'index.html' : req.path.slice(1);
  res.sendFile(path.join(STATIC_DIR, file), err => {
    if (err) res.status(404).send(`Not found: ${file}`);
  });
});

app.listen(PORT, () => {
  console.log(`Safe SFL calculator on http://127.0.0.1:${PORT}`);
  console.log(`Health: http://127.0.0.1:${PORT}/proxy/health`);
  console.log(`Debug prices: http://127.0.0.1:${PORT}/proxy/debug-prices`);
  console.log(`Debug land: http://127.0.0.1:${PORT}/proxy/debug-land/${LAND_ID}`);
});
