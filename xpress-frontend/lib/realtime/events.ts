export const CHAT_EVENTS = {
  SEND: "chat:send",
  REPLY: "chat:reply",
  DELETE: "chat:delete",
  RECALL: "chat:recall",
  TYPING: "chat:typing",
  MESSAGE: "chat:message",
  DELETED: "chat:deleted",
  RECALLED: "chat:recalled",
  PRESENCE: "chat:presence",
} as const;

export const CALL_EVENTS = {
  OFFER: "call:offer",
  ANSWER: "call:answer",
  ICE: "call:ice",
  END: "call:end",
  INCOMING: "call:incoming",
} as const;

export const GROUP_EVENTS = {
  JOIN: "group:join",
  SEND: "group:send",
  REPLY: "group:reply",
  DELETE: "group:delete",
  RECALL: "group:recall",
  TYPING: "group:typing",
  MESSAGE: "group:message",
  DELETED: "group:deleted",
  RECALLED: "group:recalled",
  UPDATED: "group:updated",
  MEMBER_JOINED: "group:member_joined",
  MEMBER_LEFT: "group:member_left",
  MEMBER_PROMOTED: "group:member_promoted",
  MESSAGE_PINNED: "group:message_pinned",
  MESSAGE_UNPINNED: "group:message_unpinned",
  CALL_STATE: "group:call_state",
} as const;
