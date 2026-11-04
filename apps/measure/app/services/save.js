// Saving a measured layout through the dev server.
export async function save(file, data) {
  const r = await fetch('/api/save/' + file, { method: 'POST', headers: { 'X-Sine': '1', 'Content-Type': 'text/plain' }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error('could not save ' + file + ' (' + r.status + ') - is the dev server running? (npm run dev)');
}
