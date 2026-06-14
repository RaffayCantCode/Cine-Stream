const https = require('https');

const urls = [
  { name: 'Source 1 (VidNest Embed)', url: 'https://vidnest.fun/anime/154768/1/sub' },
  { name: 'Source 2 (AnimePahe Embed)', url: 'https://vidnest.fun/animepahe/53065/1/sub' },
  { name: 'Source 3 (AnimePlay Embed)', url: 'https://animeplay.cfd/stream/mal/53065/1/sub' },
  { name: 'Source 4 (VidLink Embed)', url: 'https://vidlink.pro/anime/53065/1/sub?fallback=true' }
];

function checkUrl(item) {
  return new Promise((resolve) => {
    const parsed = new URL(item.url);
    const req = https.request({
      method: 'GET',
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 5000
    }, (res) => {
      resolve({
        name: item.name,
        url: item.url,
        status: res.statusCode,
        headers: res.headers
      });
    });

    req.on('error', (err) => {
      resolve({
        name: item.name,
        url: item.url,
        status: 'ERROR',
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        name: item.name,
        url: item.url,
        status: 'TIMEOUT'
      });
    });

    req.end();
  });
}

async function run() {
  console.log('Checking resolved player embed URLs...');
  const results = await Promise.all(urls.map(checkUrl));
  console.log(JSON.stringify(results, null, 2));
}

run();
