const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function inspect() {
  try {
    const globalSnap = await db.collection('config').doc('global').get();
    const tabsSnap = await db.collection('config').doc('app_tabs').get();

    console.log('--- config/global ---');
    console.log(JSON.stringify(globalSnap.data(), null, 2));
    
    console.log('\n--- config/app_tabs ---');
    console.log(JSON.stringify(tabsSnap.data(), null, 2));

  } catch (e) {
    console.error('FAILURE:', e.message);
  } finally {
    process.exit();
  }
}

inspect();
