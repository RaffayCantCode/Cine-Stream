const jojo = [14719, 20474, 20799, 21450, 102883, 131942];
const fate = [10087, 11741, 356, 19603, 20792, 20791, 21718, 21719, 98035, 103275, 154966];
async function get(ids) {
  const query = 'query ($id_in: [Int]) { Page { media(id_in: $id_in, type: ANIME) { id coverImage { extraLarge } } } }';
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { id_in: ids } })
  });
  const data = await res.json();
  return data.data.Page.media;
}
Promise.all([get(jojo), get(fate)]).then(([j, f]) => {
  console.log('JOJO:');
  j.forEach(m => console.log(m.id + ' = ' + m.coverImage.extraLarge));
  console.log('FATE:');
  f.forEach(m => console.log(m.id + ' = ' + m.coverImage.extraLarge));
});
