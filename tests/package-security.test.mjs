import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
function files(dir) { return fs.readdirSync(dir, {withFileTypes:true}).flatMap(x => ['node_modules','dist','.git','data'].includes(x.name) ? [] : x.isDirectory() ? files(path.join(dir,x.name)) : [path.join(dir,x.name)]); }
test('Public source excludes private geographic dataset and owner photo', () => {
  const list=files(root); assert(!list.some(x=>x.includes('private_review/'))); assert(!list.some(x=>x.includes('23518531-AD43'))); assert(!list.some(x=>/\.sqlite(?:-|$)/.test(x)));
});
test('No source code contains private API keys or private conversation URLs', () => {
  for(const f of files(root).filter(x=>/\.(?:mjs|js|tsx?|json|md)$/.test(x))) {
    const s=fs.readFileSync(f,'utf8');
    assert(!/sk-(?:proj-)?[A-Za-z0-9_-]{30,}/.test(s),f);
    assert(!/https:\/\/mail\.google\.com\/mail\//.test(s),f);
    assert(!/libfile_[a-f0-9]{20,}/.test(s),f);
  }
});
test('All bundled operational fixtures are synthetic and golden/showcase remain distinct',()=>{
 const g=JSON.parse(fs.readFileSync(path.join(root,'fixtures/synthetic/golden/bootstrap/colonies.json')));
 const s=JSON.parse(fs.readFileSync(path.join(root,'fixtures/synthetic/showcase/colonies.json')));
 assert.equal(g.length,18);assert.equal(s.length,18);assert(g.every(x=>x.synthetic===true));assert(s.every(x=>x.synthetic===true));assert(!g.some(x=>s.some(y=>x.id===y.id)));
});
