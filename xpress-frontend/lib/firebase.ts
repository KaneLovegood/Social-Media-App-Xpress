import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";

/**
 * Firebase web config.
 *
 * All six values prefixed with NEXT_PUBLIC_ are safe to ship to the browser —
 * they only identify which Firebase project the client talks to. Access control
 * is enforced server-side by Firebase Auth + Firebase Admin (token verification)
 * and by our NestJS guards, NOT by hiding these values.
 *
 * Secrets that must stay on the backend only:
 *   - Firebase service account (FIREBASE_SERVICE_ACCOUNT_JSON / private key)
 *   - Our JWT signing secrets (JWT_SECRET, REFRESH_TOKEN_SECRET)
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function assertConfig(): void {
  const missing = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(
      `Firebase config missing env values: ${missing
        .map((key) => `NEXT_PUBLIC_FIREBASE_${toUpperSnake(key)}`)
        .join(", ")}`,
    );
  }
}

function toUpperSnake(key: string): string {
  return key.replace(/([A-Z])/g, "_$1").toUpperCase();
}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  assertConfig();
  cachedApp = getApps()[0] ?? initializeApp(firebaseConfig);
  return cachedApp;
}

export function getFirebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getFirebaseApp());
  return cachedAuth;
}
