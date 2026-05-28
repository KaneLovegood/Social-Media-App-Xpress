export const CHAT_EVENTS = {
  SEND: "chat:send",
  REPLY: "chat:reply",
  DELETE: "chat:delete",
  RECALL: "chat:recall",
  RECEIVE: "chat:receive",
  READ: "chat:read",
  TYPING: "chat:typing",
  MESSAGE: "chat:message",
  DELETED: "chat:deleted",
  RECALLED: "chat:recalled",
  RECEIVED: "chat:received",
  PRESENCE: "chat:presence",
  GROUP_SEND: "chat:group:send",
  GROUP_TYPING: "chat:group:typing",
  GROUP_READ: "chat:group:read",
  GROUP_MESSAGE: "chat:group:message",
  GROUP_MEMBER_JOINED: "chat:group:member:joined",
  GROUP_MEMBER_LEFT: "chat:group:member:left",
  GROUP_ROOM_UPDATED: "chat:group:room:updated",
  GROUP_DISSOLVED: "chat:group:dissolved",
  GROUP_CALL_START: "chat:group:call:start",
  GROUP_CALL_STARTED: "chat:group:call:started",
  GROUP_CALL_JOIN: "chat:group:call:join",
  GROUP_CALL_OFFER: "chat:group:call:offer",
  GROUP_CALL_ANSWER: "chat:group:call:answer",
  GROUP_CALL_ICE: "chat:group:call:ice",
  GROUP_CALL_END: "chat:group:call:end",
  GROUP_CALL_LIMIT_REACHED: "chat:group:call:limit_reached",
  REACTION: "chat:reaction",
} as const;

export const CALL_EVENTS = {
  OFFER: "call:offer",
  ANSWER: "call:answer",
  ICE: "call:ice",
  END: "call:end",
  INCOMING: "call:incoming",
} as const;

export const FEED_EVENTS = {
  POST_CREATED: 'feed:post:created',
  POST_UPDATED: 'feed:post:updated',
  POST_DELETED: 'feed:post:deleted',
  REACTION_UPDATED: 'feed:reaction:updated',
  COMMENT_CREATED: 'feed:comment:created',
  COMMENT_DELETED: 'feed:comment:deleted',
} as const;

export const SOCIAL_EVENTS = {
  REQUEST_RECEIVED: "friend:request_received",
  REQUEST_ACCEPTED: "friend:request_accepted",
  REQUEST_CANCELLED: "friend:request_cancelled",
  UNFRIENDED: "friend:unfriended",
} as const;
