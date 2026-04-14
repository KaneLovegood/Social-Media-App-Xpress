export const CHAT_EVENTS = {
  SEND: 'chat:send',
  REPLY: 'chat:reply',
  DELETE: 'chat:delete',
  RECALL: 'chat:recall',
  RECEIVE: 'chat:receive',
  READ: 'chat:read',
  TYPING: 'chat:typing',
  MESSAGE: 'chat:message',
  DELETED: 'chat:deleted',
  RECALLED: 'chat:recalled',
  RECEIVED: 'chat:received',
  PRESENCE: 'chat:presence',
  ERROR: 'chat:error',
} as const;

export const CALL_EVENTS = {
  OFFER: 'call:offer',
  ANSWER: 'call:answer',
  ICE: 'call:ice',
  END: 'call:end',
  INCOMING: 'call:incoming',
} as const;
