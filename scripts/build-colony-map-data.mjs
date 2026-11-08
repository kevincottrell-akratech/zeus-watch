import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceFiles = {
  boundaries: resolve(root, 'fixtures/public-geography/miami-dade-park-boundaries.geojson'),
  points: resolve(root, 'fixtures/public-geography/miami-dade-park-points.geojson'),
  colonies: resolve(root, 'fixtures/synthetic/showcase/colonies.json'),
  mapping: resolve(root, 'fixtures/synthetic/showcase/colony_park_mapping.json'),
};
const outputFile = resolve(root, 'client/src/data/fictional-colony-map.json');

const COUNTY_DISCLAIMER = 'Miami-Dade County provides this data for use "as is". The areas depicted by this map/data are approximate, and are not accurate to surveying or engineering standards. The maps/data shown here are for illustration purposes only and are not suitable for site-specific decision making. Information found here should not be used for making financial or any other commitments. Miami-Dade County provides this information with the understanding that it is not guaranteed to be accurate, correct or complete and conclusions drawn from such information are the sole responsibility of the user. While every effort has been made to ensure the accuracy, correctness and timeliness of materials presented, Miami-Dade County assumes no responsibility for errors or omissions, even if Miami-Dade County is advised of the possibility of such damage.';

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > point[1]) !== (yj > point[1]) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInGeometry(point, geometry) {
  const inPolygon = rings => pointInRing(point, rings[0]) && !rings.slice(1).some(ring => pointInRing(point, ring));
  if (geometry?.type === 'Polygon') return inPolygon(geometry.coordinates);
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates.some(inPolygon);
  return false;
}

function indexUnique(features, field, label) {
  const map = new Map();
  for (const feature of features) {
    const key = String(feature?.properties?.[field] ?? '');
    if (!key || map.has(key)) throw new Error(`${label} has a missing or duplicate ${field}: ${key || '(empty)'}`);
    map.set(key, feature);
  }
  return map;
}

export function buildColonyMapData({ boundaries, points, colonies, mapping }) {
  if (mapping?.schema_version !== 1 || !Array.isArray(mapping.locations) || mapping.locations.length !== 18) {
    throw new Error('The fictional colony-to-park map must contain exactly 18 version 1 mappings.');
  }
  const boundaryById = indexUnique(boundaries?.features || [], 'ID', 'Park boundary layer');
  const pointById = indexUnique(points?.features || [], 'ID', 'Park point layer');
  const colonyById = new Map((colonies || []).map(colony => [colony.id, colony]));
  const seenColonies = new Set();
  const seenParks = new Set();
  const locations = [];
  const parkFeatures = [];

  for (const link of mapping.locations) {
    if (seenColonies.has(link.colony_id)) throw new Error(`Duplicate colony mapping: ${link.colony_id}`);
    if (seenParks.has(link.park_id)) throw new Error(`Duplicate park mapping: ${link.park_id}`);
    seenColonies.add(link.colony_id);
    seenParks.add(link.park_id);

    const colony = colonyById.get(link.colony_id);
    const boundary = boundaryById.get(String(link.park_id));
    const pointFeature = pointById.get(String(link.park_id));
    if (!colony) throw new Error(`The mapped stable colony ID is not in the showcase: ${link.colony_id}`);
    if (!boundary || !pointFeature) throw new Error(`Park ${link.park_id} must exist in both source layers.`);
    if (boundary.properties.NAME !== pointFeature.properties.NAME) throw new Error(`Park name mismatch for ${link.park_id}.`);
    const coordinates = pointFeature.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2 || !coordinates.every(Number.isFinite)) {
      throw new Error(`Park ${link.park_id} has invalid point coordinates.`);
    }
    if (!pointInGeometry(coordinates, boundary.geometry)) throw new Error(`Park representative point ${link.park_id} is outside its boundary.`);

    parkFeatures.push({
      type: 'Feature',
      id: String(boundary.id ?? boundary.properties.ID),
      geometry: boundary.geometry,
      properties: { ...boundary.properties },
    });
    locations.push({
      colony_id: colony.id,
      colony_alias: colony.alias,
      colony_name: colony.display_name,
      park_id: String(link.park_id),
      park_name: boundary.properties.NAME,
      coordinates: [coordinates[0], coordinates[1]],
      fictional: true,
      provenance_label: 'fictional_demo',
    });
  }

  if (seenColonies.size !== colonyById.size || [...colonyById.keys()].some(id => !seenColonies.has(id))) {
    throw new Error('Every existing showcase colony must have exactly one fixed fictional map location.');
  }

  return {
    type: 'FeatureCollection',
    name: 'fictional_colony_map_demo',
    provenance_label: 'fictional_demo',
    fictional_notice: 'Fictional demo locations only. No real colony presence is asserted.',
    parks: { type: 'FeatureCollection', features: parkFeatures },
    locations,
    attribution: {
      countyName: 'Miami-Dade County',
      countySourceUrl: 'https://gisws.miamidade.gov/arcgis/rest/services/LocalGov/MD_LocalGovernment/MapServer/14',
      countyPointSourceUrl: 'https://gisws.miamidade.gov/arcgis/rest/services/LocalGov/MD_LocalGovernment/MapServer/9',
      countyTermsUrl: 'https://opendata.miamidade.gov/pages/terms-of-use',
      countyDisclaimer: COUNTY_DISCLAIMER,
      basemapName: 'OpenStreetMap',
      basemapAttribution: '© OpenStreetMap contributors',
      basemapCopyrightUrl: 'https://www.openstreetmap.org/copyright',
      basemapTilePolicyUrl: 'https://operations.osmfoundation.org/policies/tiles/',
    },
  };
}

export function generateColonyMapData() {
  const read = path => JSON.parse(readFileSync(path, 'utf8'));
  const mapData = buildColonyMapData({
    boundaries: read(sourceFiles.boundaries),
    points: read(sourceFiles.points),
    colonies: read(sourceFiles.colonies),
    mapping: read(sourceFiles.mapping),
  });
  mkdirSync(dirname(outputFile), { recursive: true });
  writeFileSync(outputFile, `${JSON.stringify(mapData, null, 2)}\n`);
  return outputFile;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  console.log(`Generated ${generateColonyMapData()}`);
}
