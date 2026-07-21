/**
 * One-shot: Indonesian country names & dates → English across project files.
 * Run: node supabase/seed/translate-en.js
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');

// Longer names first to avoid partial matches
const COUNTRY_MAP = [
  ['Afrika Selatan', 'South Africa'],
  ['Amerika Serikat', 'United States'],
  ['Bosnia-Herzegovina', 'Bosnia and Herzegovina'],
  ['Pantai Gading', 'Ivory Coast'],
  ['Tanjung Verde', 'Cape Verde'],
  ['RD Kongo', 'DR Congo'],
  ['Belanda', 'Netherlands'],
  ['Maroko', 'Morocco'],
  ['Jerman', 'Germany'],
  ['Prancis', 'France'],
  ['Swedia', 'Sweden'],
  ['Belgia', 'Belgium'],
  ['Spanyol', 'Spain'],
  ['Kroasia', 'Croatia'],
  ['Brasil', 'Brazil'],
  ['Jepang', 'Japan'],
  ['Norwegia', 'Norway'],
  ['Meksiko', 'Mexico'],
  ['Ekuador', 'Ecuador'],
  ['Inggris', 'England'],
  ['Aljazair', 'Algeria'],
  ['Kolombia', 'Colombia'],
  ['Mesir', 'Egypt'],
  ['Kanada', 'Canada'],
];

const DATE_MAP = [
  ['Sen,', 'Mon,'],
  ['Sel,', 'Tue,'],
  ['Rab,', 'Wed,'],
  ['Kam,', 'Thu,'],
  ['Jum,', 'Fri,'],
  ['Sab,', 'Sat,'],
  ['Min,', 'Sun,'],
  [' Juni,', ' June,'],
  [' Juli,', ' July,'],
  ['Juni,', 'June,'],
  ['Juli,', 'July,'],
];

const FILES = [
  'communities/hash-pku/leagues/wc-2026/index.html',
  'communities/hash-pku/leagues/wc-2026/admin.html',
  'shared/js/bracket-app.js',
  'supabase/seed/generate-seed.js',
];

function translateContent(text) {
  let out = text;
  for (const [from, to] of COUNTRY_MAP) {
    out = out.split(from).join(to);
  }
  for (const [from, to] of DATE_MAP) {
    out = out.split(from).join(to);
  }
  return out;
}

for (const rel of FILES) {
  const fp = path.join(root, rel);
  const before = fs.readFileSync(fp, 'utf8');
  const after = translateContent(before);
  if (before !== after) {
    fs.writeFileSync(fp, after, 'utf8');
    console.log('Updated', rel);
  } else {
    console.log('No change', rel);
  }
}

console.log('Done. Run: node supabase/seed/generate-seed.js');
