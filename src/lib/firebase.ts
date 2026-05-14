import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, limit, onSnapshot, getDocFromServer, increment
} from 'firebase/firestore';
import rawConfig from '../../firebase-applet-config.json';

const firebaseConfig = (function() {
  try {
    return rawConfig;
  } catch (_e) {
    console.error("Firebase config file missing or unreadable.");
    return {} as any;
  }
})();

let app: any;
let db: any = null;
let auth: any = null;

try {
  if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    
    // Initialize Firestore with persistent cache
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      }, (firebaseConfig as any).firestoreDatabaseId);
    } catch (e) {
      console.warn("Firestore initialization with cache failed, falling back to basic:", e);
      // Fallback to basic initialization
      db = initializeFirestore(app, {});
    }

    try {
      auth = getAuth(app);
    } catch (e) {
      console.warn("Auth initialization failed:", e);
    }
  } else {
    console.warn("Firebase configuration is missing or incomplete (apiKey/projectId). Database features will not work.");
  }
} catch (error) {
  console.error("Critical Firebase error:", error);
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
    authInfo: auth?.currentUser ? {
      userId: auth.currentUser.uid,
      email: auth.currentUser.email,
      emailVerified: auth.currentUser.emailVerified,
    } : null,
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
