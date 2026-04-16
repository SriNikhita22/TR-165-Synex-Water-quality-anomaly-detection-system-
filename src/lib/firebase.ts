import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfigData from '../../firebase-applet-config.json';

// Sanitize config
const firebaseConfig = Object.fromEntries(
  Object.entries(firebaseConfigData || {}).map(([key, value]) => [
    key, 
    typeof value === 'string' ? value.trim() : value
  ])
) as any;

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth, firebaseConfig };
export default app;
