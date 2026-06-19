const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;
const STATIC_DIR = process.env.STATIC_DIR || process.cwd();

// --- АДРЕСА API ---
const PRICES_URL = 'https://sfl.world/api/v1/prices'; // Сторонний сервис для цен
const LAND_ID = process.env.LAND_ID || '129628';

// Ключ берется из скрытых настроек Render (Environment Variables)
const COMMUNITY_API_KEY = process.env.SFL_API_KEY || ''; 
const COMMUNITY_URL = (id = LAND_ID) => `https://api.sunflower-land.com/community/farms/${id}`;

// Универсальная функция запроса (поддерживает передачу ключей)
async function fetchText(url, extraHeaders = {}) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json,text/plain,*/*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ...extraHeaders
    }
  });
  const text = await res.text();
  return { res, text };
}

app.get('/proxy/health', (_req, res) => {
  res.json({ ok: true, hasKey: !!COMMUNITY_API_KEY, port: PORT });
});

// 1. ПРОКСИ ДЛЯ ЦЕН (SFL World - оставляем как было)
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

// 2. НОВЫЙ ПРОКСИ ДЛЯ БАФФОВ ФЕРМЫ (Официальное API с ключом)
app.get('/proxy/community-farm/:id?', async (req, res) => {
  const id = req.params.id || LAND_ID;
  try {
    const { res: upstream, text } = await fetchText(COMMUNITY_URL(id), {
      'X-API-Key': COMMUNITY_API_KEY
    });
    res.status(upstream.status);
    const type = upstream.headers.get('content-type');
    if (type) res.setHeader('content-type', type);
    res.setHeader('access-control-allow-origin', '*');
    res.send(text);
  } catch (error) {
    res.status(502).json({ error: 'Bad Gateway', message: error.message, landId: id });
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
  console.log(`🚀 SFL Simulator (Hybrid API) on http://127.0.0.1:${PORT}`);
  if (!COMMUNITY_API_KEY) console.warn("ВНИМАНИЕ: SFL_API_KEY не задан в переменных окружения!");
});
