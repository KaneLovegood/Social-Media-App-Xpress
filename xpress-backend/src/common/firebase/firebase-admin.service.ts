import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

/**
 * Thin wrapper around firebase-admin for authentication use cases.
 *
 * Initialization strategy (first match wins):
 *   1. FIREBASE_SERVICE_ACCOUNT_JSON - full JSON string of the service account
 *      (useful for 12-factor deploys like Heroku / ECS).
 *   2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 *      (separate env vars; PRIVATE_KEY uses \n literals that we unescape).
 *   3. GOOGLE_APPLICATION_CREDENTIALS path / Application Default Credentials
 *      (works on GCP, Cloud Run, GCE, and local `gcloud auth`).
 *
 * The admin app is initialized exactly once per process.
 */
@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private app: admin.app.App | null = null;

  onModuleInit(): void {
    this.getApp();
  }

  getApp(): admin.app.App {
    if (this.app) return this.app;
    if (admin.apps.length > 0) {
      this.app = admin.app();
      return this.app;
    }

    this.warnIfCredentialsMissing();
    const credential = this.resolveCredential();
    const projectId = process.env.FIREBASE_PROJECT_ID;
    this.app = admin.initializeApp(
      projectId ? { credential, projectId } : { credential },
    );
    this.logger.log('Firebase Admin SDK initialized');
    return this.app;
  }

  /**
   * Verify a Firebase ID token produced by the client SDK.
   *
   * `checkRevoked` defaults to false: when true, Admin calls the Auth backend
   * for every login; that can fail on misconfigured hosts or tight IAM and
   * surfaces as 401 "Firebase token không hợp lệ". Set
   * FIREBASE_CHECK_REVOKED=true if you need revocation checks.
   */
  verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    const checkRevoked =
      (process.env.FIREBASE_CHECK_REVOKED ?? '').toLowerCase() === 'true';
    return this.getApp().auth().verifyIdToken(idToken, checkRevoked);
  }

  private warnIfCredentialsMissing(): void {
    const hasJson =
      (process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '').trim().length > 0;
    const hasSplit =
      (process.env.FIREBASE_PROJECT_ID ?? '').trim().length > 0 &&
      (process.env.FIREBASE_CLIENT_EMAIL ?? '').trim().length > 0 &&
      (process.env.FIREBASE_PRIVATE_KEY ?? '').trim().length > 0;
    const hasAdcPath =
      (process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '').trim().length > 0;

    if (!hasJson && !hasSplit && !hasAdcPath) {
      this.logger.warn(
        'Firebase Admin: no FIREBASE_SERVICE_ACCOUNT_JSON, no FIREBASE_* cert triple, and no GOOGLE_APPLICATION_CREDENTIALS. ' +
          'Using Application Default Credentials — on a plain VPS (e.g. EC2) this usually fails ID token verification. ' +
          'Add a service account from the same Firebase project as the web app.',
      );
    }
  }

  private resolveCredential(): admin.credential.Credential {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson && serviceAccountJson.trim().length > 0) {
      try {
        const parsed = JSON.parse(serviceAccountJson) as admin.ServiceAccount;
        return admin.credential.cert(parsed);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'unknown parse error';
        throw new Error(
          `FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: ${message}`,
        );
      }
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
    if (projectId && clientEmail && privateKeyRaw) {
      return admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKeyRaw.replace(/\\n/g, '\n'),
      });
    }

    return admin.credential.applicationDefault();
  }
}
