const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;
const STATIC_DIR = process.env.STATIC_DIR || process.cwd();
const PRICES_URL = 'https://sfl.world/api/v1/prices';

async function fetchUpstream() {
  const res = await fetch(PRICES_URL, {
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
    authRequired: false,
    staticDir: STATIC_DIR
  });
});

app.get('/proxy/debug-prices', async (_req, res) => {
  try {
    const { res: upstream, text } = await fetchUpstream();
    res.json({
      ok: upstream.ok,
      status: upstream.status,
      contentType: upstream.headers.get('content-type'),
      preview: text.slice(0, 1000)
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error.message
    });
  }
});

app.get('/proxy/sfl-prices', async (_req, res) => {
  try {
    const { res: upstream, text } = await fetchUpstream();
    res.status(upstream.status);

    const type = upstream.headers.get('content-type');
    if (type) res.setHeader('content-type', type);

    res.setHeader('access-control-allow-origin', '*');
    res.send(text);
  } catch (error) {
    res.status(502).json({
      error: 'Bad Gateway',
      message: error.message
    });
  }
});

app.use(express.static(STATIC_DIR));

app.get('*', (req, res) => {
  const file = req.path === '/' ? 'index.html' : req.path.slice(1);

  res.sendFile(path.join(STATIC_DIR, file), (err) => {
    if (err) res.status(404).send(`Not found: ${file}`);
  });
});

app.listen(PORT, () => {
  console.log(`Safe SFL calculator on http://127.0.0.1:${PORT}`);
  console.log(`Health: http://127.0.0.1:${PORT}/proxy/health`);
  console.log(`Debug:  http://127.0.0.1:${PORT}/proxy/debug-prices`);
});
