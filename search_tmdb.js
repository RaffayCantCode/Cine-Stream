const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const tokenMatch = env.match(/TMDB_API_KEY=(.+)/);
const token = tokenMatch ? tokenMatch[1].trim() : '';
async function search() {
  const res = await fetch('https://api.themoviedb.org/3/search/movie?query=Obsession&primary_release_year=2026', {headers: {Authorization: 'Bearer ' + token}}).then(r => r.json());
  console.log(JSON.stringify(res.results.slice(0, 3)));
}
search();
