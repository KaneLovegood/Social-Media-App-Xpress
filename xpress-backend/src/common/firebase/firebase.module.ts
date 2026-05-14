import { Global, Module } from '@nestjs/common';
import { FirebaseAdminService } from './firebase-admin.service';

/**
 * Global Firebase module - any feature module can inject FirebaseAdminService
 * without importing FirebaseModule explicitly.
 */
@Global()
@Module({
  providers: [FirebaseAdminService],
  exports: [FirebaseAdminService],
})
export class FirebaseModule {}
