const fs = require('fs');
const path = require('path');

const envVars = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'FIREBASE_MEASUREMENT_ID'
];

const missing = envVars.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error(`[generate-firebase-env] Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const targetPath = path.join(__dirname, '..', 'src', 'environments', 'environment.prod.ts');

const content =
  'export const environment = {\n' +
  '  production: true,\n' +
  '  firebaseConfig: {\n' +
  `    apiKey: '${process.env.FIREBASE_API_KEY}',\n` +
  `    authDomain: '${process.env.FIREBASE_AUTH_DOMAIN}',\n` +
  `    projectId: '${process.env.FIREBASE_PROJECT_ID}',\n` +
  `    storageBucket: '${process.env.FIREBASE_STORAGE_BUCKET}',\n` +
  `    messagingSenderId: '${process.env.FIREBASE_MESSAGING_SENDER_ID}',\n` +
  `    appId: '${process.env.FIREBASE_APP_ID}',\n` +
  `    measurementId: '${process.env.FIREBASE_MEASUREMENT_ID}'\n` +
  '  }\n' +
  '};\n';

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, content, 'utf8');
console.log(`[generate-firebase-env] wrote ${targetPath}`);
