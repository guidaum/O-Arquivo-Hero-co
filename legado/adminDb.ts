import { Firestore } from '@google-cloud/firestore';

async function main() {
  const firestore = new Firestore({
    projectId: 'ai-studio-applet-webapp-1c0a0',
    databaseId: 'ai-studio-092e1db6-ac4f-4143-8296-2906661868bd'
  });

  const collections = ['skills', 'powers', 'traits', 'itemCatalog', 'globalSettings', 'gameSessions', 'characters'];

  for (const colName of collections) {
    try {
      const colRef = firestore.collection(colName);
      const snapshot = await colRef.get();
      console.log(`\n=== Collection: ${colName} (${snapshot.size} documents) ===`);
      
      snapshot.forEach(doc => {
        console.log(`Document ID: ${doc.id}`);
        console.log(JSON.stringify(doc.data(), null, 2));
      });
    } catch (err: any) {
      console.error(`Error reading ${colName}:`, err.message);
    }
  }
}

main().catch(err => {
  console.error('Script failed:', err);
});
