import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Read config
const configPath = path.resolve('firebase-applet-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

const collections = [
  'users',
  'characters',
  'gameSessions',
  'journalEntries',
  'talents',
  'skills',
  'powers',
  'traits',
  'itemCatalog',
  'worldMaps',
  'dungeonMaps',
  'dungeonTokens',
  'dungeonMarkers',
  'dungeonDrawings',
  'dungeonAoEs',
  'dungeonPings',
  'dungeonFog',
  'dungeonAtmosphere',
  'mapPins',
  'mapDrawings',
  'worldMapPings',
  'chatMessages',
  'customSounds',
  'suggestions',
  'admins',
  'globalSettings',
  'rolePermissions',
  'campaignMaps'
];

async function dump() {
  const result: Record<string, Array<{ id: string; data: any }>> = {};
  console.log('Starting Firestore dump...');

  for (const colName of collections) {
    try {
      const snap = await getDocs(collection(db, colName));
      const docs: Array<{ id: string; data: any }> = [];
      snap.forEach(docSnap => {
        docs.push({ id: docSnap.id, data: docSnap.data() });
      });
      result[colName] = docs;
      console.log(`[OK] ${colName}: ${docs.length} documents`);
    } catch (err: any) {
      console.error(`[ERR] ${colName}:`, err.message);
      result[colName] = [];
    }
  }

  const outDir = path.resolve('dump_data');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(path.join(outDir, 'firestore_dump.json'), JSON.stringify(result, null, 2), 'utf-8');
  console.log('Dump completed successfully! Output written to dump_data/firestore_dump.json');
  process.exit(0);
}

dump().catch(err => {
  console.error('Fatal dump error:', err);
  process.exit(1);
});
