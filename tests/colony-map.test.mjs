import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { buildColonyMapData } from '../scripts/build-colony-map-data.mjs';

const root = resolve(import.meta.dirname, '..');
const readJson = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

test('map layers are isolated and both map selections open the authorized habitat drawer', () => {
  const css = readFileSync(resolve(root, 'client/src/colony-map/colony-map.css'), 'utf8');
  const component = readFileSync(resolve(root, 'client/src/colony-map/ColonyMap.tsx'), 'utf8');
  const app = readFileSync(resolve(root, 'client/src/App.tsx'), 'utf8');
  const frame = css.match(/\.colony-map-frame\s*\{([^}]+)\}/)?.[1] || '';
  assert.match(frame, /isolation:\s*isolate/);
  assert.match(frame, /contain:\s*paint/);
  assert.match(frame, /overflow:\s*hidden/);
  assert.match(component, /new ResizeObserver/);
  assert.match(component, /map\.invalidateSize/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(app, /onOpenColony=\{colony=>open\('colonies',colony\)\}/);
  assert.match(component, /marker\.on\("click"/);
  assert.match(component, /onClick=\{\(\) => selectColony\(colony\)\}/);
  assert.equal(component.match(/onOpenColonyRef\.current\(colony\)/g)?.length, 2);
  assert.match(app, /<DrawerLayer open=\{!!drawer\}>/);
  assert.match(app, /drawer\?\.type==='colonies'\?<SelectedColonyView/);
  const layer = readFileSync(resolve(root, 'client/src/DrawerLayer.tsx'), 'utf8');
  assert.match(layer, /createPortal/);
  assert.match(layer, /document\.body/);
});

test('fictional map uses one explicit, stable-ID example for each showcase colony', () => {
  const boundaries = readJson('fixtures/public-geography/miami-dade-park-boundaries.geojson');
  const points = readJson('fixtures/public-geography/miami-dade-park-points.geojson');
  const colonies = readJson('fixtures/synthetic/showcase/colonies.json');
  const mapping = readJson('fixtures/synthetic/showcase/colony_park_mapping.json');
  const sourceSnapshots = [boundaries, points, colonies, mapping].map(value => JSON.stringify(value));

  const result = buildColonyMapData({ boundaries, points, colonies, mapping });

  assert.equal(result.locations.length, 18);
  assert.equal(result.parks.features.length, 18);
  assert.deepEqual(
    [...result.locations.map(location => location.colony_id)].sort(),
    colonies.map(colony => colony.id).sort(),
  );
  assert.equal(new Set(result.locations.map(location => location.colony_id)).size, 18);
  assert.equal(new Set(result.locations.map(location => location.park_id)).size, 18);
  for (const location of result.locations) {
    const sourcePoint = points.features.find(feature => String(feature.properties.ID) === location.park_id);
    const sourceBoundary = boundaries.features.find(feature => String(feature.properties.ID) === location.park_id);
    assert.ok(sourcePoint, `point source exists for ${location.park_id}`);
    assert.ok(sourceBoundary, `boundary source exists for ${location.park_id}`);
    assert.deepEqual(location.coordinates, sourcePoint.geometry.coordinates);
    assert.equal(location.park_name, sourceBoundary.properties.NAME);
    assert.equal(location.fictional, true);
    assert.equal(location.provenance_label, 'fictional_demo');
  }
  assert.equal(result.parks.features.length < boundaries.features.length, true);
  assert.match(result.fictional_notice, /No real colony presence is asserted/);
  assert.match(result.attribution.countyDisclaimer, /for illustration purposes only/);
  assert.equal(result.attribution.countySourceUrl.endsWith('/MapServer/14'), true);
  assert.equal(result.attribution.countyPointSourceUrl.endsWith('/MapServer/9'), true);

  assert.deepEqual(
    [boundaries, points, colonies, mapping].map(value => JSON.stringify(value)),
    sourceSnapshots,
    'building map data must not mutate source geography, colony records, or the mapping',
  );
});

test('map payload contains only park references and no volunteer or care-record fields', () => {
  const result = buildColonyMapData({
    boundaries: readJson('fixtures/public-geography/miami-dade-park-boundaries.geojson'),
    points: readJson('fixtures/public-geography/miami-dade-park-points.geojson'),
    colonies: readJson('fixtures/synthetic/showcase/colonies.json'),
    mapping: readJson('fixtures/synthetic/showcase/colony_park_mapping.json'),
  });
  const serialized = JSON.stringify(result);

  assert.doesNotMatch(serialized, /volunteer|assignee|care_action|issue_summary/i);
  assert.equal(result.locations.every(location => Object.keys(location).sort().join(',') === [
    'colony_alias',
    'colony_id',
    'colony_name',
    'coordinates',
    'fictional',
    'park_id',
    'park_name',
    'provenance_label',
  ].sort().join(',')), true);
});
