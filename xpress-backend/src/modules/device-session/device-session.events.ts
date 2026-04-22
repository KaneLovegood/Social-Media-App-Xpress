export const DEVICE_SESSION_NAMESPACE = '/device-sessions';

export const DEVICE_SESSION_EVENTS = {
  FORCE_LOGOUT: 'auth.session.force-logout',
  BIND_ACK: 'auth.session.bind-ack',
} as const;

export interface ForceLogoutPayload {
  reason: 'NEW_DEVICE_LOGIN' | 'SESSION_REVOKED' | 'PASSWORD_CHANGED';
  newDeviceName?: string;
  newDeviceId?: string;
  at: string;
}
