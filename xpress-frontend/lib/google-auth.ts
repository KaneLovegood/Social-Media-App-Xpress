import { Capacitor } from "@capacitor/core";
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { getFirebaseAuth } from "./firebase";

/**
 * Unified Google Sign-In entry point for Web (Next.js) and Native (Capacitor).
 *
 * Why this exists:
 * - `signInWithPopup` / `signInWithRedirect` trigger Google's OAuth consent
 *   screen which is BLOCKED inside mobile WebViews (`disallowed_useragent`).
 * - On native Capacitor apps we must call the OS-native Google Sign-In SDK
 *   through `@capacitor-firebase/authentication`, then replay the ID token
 *   into the Firebase Web SDK via `signInWithCredential` so the web layer's
 *   Firebase auth state is in sync.
 *
 * The function always returns the Firebase ID token that the NestJS backend
 * verifies with the Firebase Admin SDK.
 */

export type GoogleSignInPlatform = "web" | "android" | "ios";

export type GoogleSignInResult = {
  idToken: string;
  platform: GoogleSignInPlatform;
};

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function currentPlatform(): GoogleSignInPlatform {
  try {
    const platform = Capacitor.getPlatform();
    if (platform === "android" || platform === "ios") return platform;
    return "web";
  } catch {
    return "web";
  }
}

/**
 * Sign in with Google and return a Firebase ID token to send to the backend.
 *
 * The backend (NestJS) uses Firebase Admin SDK to verify the token, then
 * issues its own JWT pair.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  if (isNativePlatform()) {
    return signInWithGoogleNative();
  }
  return signInWithGoogleWeb();
}

/**
 * Web flow: open Firebase's Google popup and return the current user's
 * Firebase ID token. Popups are the simplest DX on desktop browsers.
 * Fallback to redirect if popups are blocked (common on Safari iOS).
 */
async function signInWithGoogleWeb(): Promise<GoogleSignInResult> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();
    return { idToken, platform: "web" };
  } catch (error) {
    if (isPopupBlockedError(error)) {
      await signInWithRedirect(auth, provider);
      throw new Error(
        "Trình duyệt chặn cửa sổ popup, đang chuyển hướng sang Google...",
      );
    }
    throw error;
  }
}

/**
 * Native flow (Android/iOS): run native Google Sign-In through the
 * @capacitor-firebase/authentication plugin, then bridge the credential
 * into the Firebase Web SDK so `auth.currentUser` is populated.
 *
 * The plugin is loaded dynamically so this module still builds on the web
 * bundle where the plugin is not installed.
 */
async function signInWithGoogleNative(): Promise<GoogleSignInResult> {
  const { FirebaseAuthentication } = await import(
    "@capacitor-firebase/authentication"
  );
  const result = await FirebaseAuthentication.signInWithGoogle();
  const idToken = result.credential?.idToken;
  if (!idToken) {
    throw new Error("Google Sign-In không trả về ID token trên thiết bị.");
  }

  const auth = getFirebaseAuth();
  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, credential);
  const firebaseIdToken = await userCredential.user.getIdToken();

  return {
    idToken: firebaseIdToken,
    platform: currentPlatform() as "android" | "ios",
  };
}

export async function signOutFromFirebase(): Promise<void> {
  const auth = getFirebaseAuth();
  await signOut(auth).catch(() => undefined);

  if (isNativePlatform()) {
    try {
      const { FirebaseAuthentication } = await import(
        "@capacitor-firebase/authentication"
      );
      await FirebaseAuthentication.signOut();
    } catch {
      // Native sign-out failure must not block the app logout flow.
    }
  }
}

function isPopupBlockedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  return (
    code === "auth/popup-blocked" ||
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request"
  );
}
