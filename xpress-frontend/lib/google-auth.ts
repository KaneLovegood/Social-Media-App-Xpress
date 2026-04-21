import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";

/**
 * Unified Google Sign-In entry point for Web (Next.js) and Native (Capacitor).
 *
 * Architecture:
 * - Web browser: uses Google Identity Services (rendered by the login page) to
 *   produce an ID token. We do NOT call this helper on web; the GIS button
 *   returns the credential directly.
 * - Native (Android/iOS Capacitor WebView): GIS is blocked inside a WebView,
 *   so we must use the native Google Sign-In flow. `@capgo/capacitor-social-login`
 *   wraps Google's Credential Manager on Android and Sign in with Google on iOS.
 *
 * On Android, Google authenticates the APK via the Android OAuth Client ID
 * registered with the matching package name + SHA-1 fingerprint. The Android
 * Client ID is NOT passed in code — Google looks it up at runtime from the
 * signing certificate. What we DO pass is the Web Client ID as `webClientId`,
 * which becomes the `aud` of the returned ID token so the NestJS backend can
 * verify it exactly the same way as a web login.
 */

export type GoogleSignInResult = {
  idToken: string;
  platform: "web" | "android" | "ios";
};

const GOOGLE_WEB_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const GOOGLE_IOS_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";

let initializePromise: Promise<void> | null = null;

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function currentPlatform(): "web" | "android" | "ios" {
  try {
    const platform = Capacitor.getPlatform();
    if (platform === "android" || platform === "ios") return platform;
    return "web";
  } catch {
    return "web";
  }
}

/**
 * Initialize SocialLogin exactly once. Safe to call multiple times — subsequent
 * calls return the same promise. No-op on web (we still use GIS there).
 */
export function initializeSocialLogin(): Promise<void> {
  if (!isNativePlatform()) {
    return Promise.resolve();
  }

  if (!GOOGLE_WEB_CLIENT_ID) {
    return Promise.reject(
      new Error(
        "NEXT_PUBLIC_GOOGLE_CLIENT_ID (Web OAuth Client ID) is required for native Google Sign-In.",
      ),
    );
  }

  if (!initializePromise) {
    initializePromise = SocialLogin.initialize({
      google: {
        webClientId: GOOGLE_WEB_CLIENT_ID,
        ...(GOOGLE_IOS_CLIENT_ID
          ? {
              iOSClientId: GOOGLE_IOS_CLIENT_ID,
              iOSServerClientId: GOOGLE_WEB_CLIENT_ID,
            }
          : {}),
        mode: "online",
      },
    }).catch((error: unknown) => {
      initializePromise = null;
      throw error;
    });
  }

  return initializePromise;
}

/**
 * Trigger the native Google Sign-In flow on Android/iOS and return the ID token.
 * Throws when called on web — the web login page should use the GIS button instead.
 */
export async function signInWithGoogleNative(): Promise<GoogleSignInResult> {
  const platform = currentPlatform();
  if (platform === "web") {
    throw new Error(
      "signInWithGoogleNative() is only supported on native platforms. Use the Google Identity Services button on web.",
    );
  }

  await initializeSocialLogin();

  // NOTE: Do NOT pass a `scopes` array here on Android. The @capgo/capacitor-
  // social-login plugin uses Credential Manager to produce the ID token, which
  // already includes `email` + `profile` claims. Passing custom scopes forces
  // the plugin into a separate Authorization flow that requires overriding
  // MainActivity.onActivityResult — hence the
  // "You CANNOT use scopes without modifying the main activity" error.
  const response = await SocialLogin.login({
    provider: "google",
    options: {},
  });

  if (response.provider !== "google") {
    throw new Error("Unexpected provider response from SocialLogin.login");
  }

  const result = response.result;
  if (result.responseType !== "online" || !result.idToken) {
    throw new Error(
      "Google Sign-In did not return an ID token. Check that webClientId is a Web OAuth Client ID and the Android SHA-1 fingerprint is registered on the Android OAuth Client ID.",
    );
  }

  return {
    idToken: result.idToken,
    platform,
  };
}

/**
 * Sign out from the native Google session. Safe to call on web (no-op).
 */
export async function signOutGoogleNative(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await SocialLogin.logout({ provider: "google" });
  } catch {
    // Logout failure shouldn't block the app logout flow.
  }
}
