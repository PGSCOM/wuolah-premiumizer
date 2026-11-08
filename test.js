// node test.js  (requiere `npm i pdf-lib`)
const fs = require('fs');
const assert = require('assert');
const premiumize = require('./premiumize.js');

(async () => {
  const r = await premiumize(fs.readFileSync('ejemplos/wuolah-free-TEMA-2.pdf'), require('pdf-lib'));
  assert.strictEqual(r.total, 23);
  assert.strictEqual(r.kept.length, 20); // 21 del premium menos su portada
  assert.ok(!r.kept.includes(0) && !r.kept.includes(6) && !r.kept.includes(14)); // portada y anuncios fuera
  fs.writeFileSync(require('os').tmpdir() + '/premiumized.pdf', r.bytes);
  console.log('ok', r.kept.length, 'páginas,', r.bytes.length, 'bytes');
})();
