import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, limit, onSnapshot, getDocFromServer, increment,
  enableIndexedDbPersistence
} from 'firebase/firestore';
import rawConfig from '../../firebase-applet-config.json';

const firebaseConfig = (function() {
  try {
    return rawConfig;
  } catch (e) {
    console.error("Firebase config file missing or unreadable.");
    return {} as any;
  }
})();

let app: any;
let db: any;
let auth: any;

try {
  if (firebaseConfig && Object.keys(firebaseConfig).length > 0 && (firebaseConfig as any).apiKey) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
    auth = getAuth(app);

    // Enable persistence for offline mode
    if (typeof window !== 'undefined') {
      enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
          // Multiple tabs open, persistence can only be enabled in one tab at a time.
          console.warn('Persistence failed-precondition');
        } else if (err.code === 'unimplemented') {
          // The current browser does not support all of the features needed to enable persistence
          console.warn('Persistence unimplemented');
        }
      });
    }
  } else {
    console.warn("Firebase configuration is incomplete. Database features will not work.");
  }
} catch (error) {
  console.error("Failed to initialize Firebase:", error);
}

export { db, auth };
export const googleProvider = new GoogleAuthProvider();

export { 
  collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, limit, onSnapshot, getDocFromServer, increment,
  signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword
};

// Error handler for Firestore
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
