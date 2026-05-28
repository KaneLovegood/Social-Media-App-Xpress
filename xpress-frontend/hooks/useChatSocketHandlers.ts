import { useEffect, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";
import { CHAT_EVENTS, CALL_EVENTS } from "@/lib/realtime/events";
import {
  CallEndPayload,
  ChatMessage,
  ReactionPayload,
  GroupCallEndPayload,
  GroupCallStartedPayload,
  MessageStateUpdate,
  PresencePayload,
  TypingPayload,
} from "@/lib/realtime/types";
import { GroupRoomDetails } from "@/lib/chat-groups";
import {
  toPrivateRoomId,
  toAgeLabel,
  toMessagePreview,
  mergeMessages,
  sortMessages,
} from "@/lib/chat-utils";
import { ChatRoomSummary } from "@/lib/chat-rooms";

type CallMode = "voice" | "video" | null;
type CallDirection = "incoming" | "outgoing" | null;

interface IncomingCallState {
  senderId: string;
  senderName: string;
  callMode: "voice" | "video";
  sessionId: string;
  isOnline: boolean;
}

interface PendingGroupCallState {
  roomId: string;
  callMode: "voice" | "video";
  senderId: string;
}

interface SocketHandlerProps {
  socket: Socket | null;
  currentUserId: string;
  effectiveActiveRoomId: string;
  activeRoomRoomType: "PRIVATE" | "GROUP" | null;
  peerUserId: string;
  roomByPeer: Map<string, string>;
  reloadRooms: () => Promise<void>;
  ensureGroupDetails: (roomId: string) => Promise<GroupRoomDetails>;
  setMessages: (
    updater: (prev: Record<string, ChatMessage[]>) => Record<string, ChatMessage[]>,
  ) => void;
  setRooms: (updater: (prev: ChatRoomSummary[]) => ChatRoomSummary[]) => void;
  setGroupDetails: (
    updater: (prev: Record<string, GroupRoomDetails>) => Record<string, GroupRoomDetails>,
  ) => void;
  setPresenceByUser: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  setTypingText: (text: string) => void;
  setTypingSenderId?: (id: string) => void;
  setIncomingCall: (state: IncomingCallState | null) => void;
  activeRoomId?: string;
  setActiveRoomId?: (roomId: string) => void;
  groupCallRoomId?: string;
  groupCallMode?: CallMode;
  groupCallHostUserId?: string;
  pendingGroupCall?: PendingGroupCallState | null;
  rejoinableGroupCall?: {
    roomId: string;
    callMode: "voice" | "video";
    callHostUserId: string;
  } | null;
  setGroupCallRoomId: (roomId: string) => void;
  setGroupCallMode: (mode: CallMode) => void;
  setGroupCallDirection: (dir: CallDirection) => void;
  setGroupCallHostUserId: (userId: string) => void;
  setPendingGroupCall: (call: PendingGroupCallState | null) => void;
  setRejoinableGroupCall: (
    call:
      | {
          roomId: string;
          callMode: "voice" | "video";
          callHostUserId: string;
        }
      | null,
  ) => void;
  setCallMode: (mode: CallMode) => void;
  setCallDirection: (dir: CallDirection) => void;
}

export function useChatSocketHandlers(props: SocketHandlerProps) {
  const {
    socket,
    currentUserId,
    effectiveActiveRoomId,
    peerUserId,
    roomByPeer,
    reloadRooms,
    ensureGroupDetails,
    setMessages,
    setRooms,
    setGroupDetails,
    setPresenceByUser,
    setTypingText,
    setTypingSenderId,
    setIncomingCall,
    setGroupCallRoomId,
    setGroupCallMode,
    setGroupCallDirection,
    setGroupCallHostUserId,
    setPendingGroupCall,
    setRejoinableGroupCall,
    setCallMode,
    setCallDirection,
  } = props;

  const typingTimeoutRef = useRef<number | null>(null);
  const recentGroupCallLogIdsRef = useRef<Set<string>>(new Set());

  const onMessage = useCallback(
    (message: ChatMessage) => {
      // only handle private messages here
      const isPrivateConversation =
        message.roomType === "PRIVATE" || message.conversationId.includes(":");
      if (message.roomType === "GROUP" || !isPrivateConversation) return;

      const counterpartUserId =
        message.senderId === currentUserId ? message.receiverId : message.senderId;
      const roomId = roomByPeer.get(counterpartUserId) ?? toPrivateRoomId(currentUserId, counterpartUserId);

      const isIncoming = message.receiverId === currentUserId;
      const shouldIncreaseUnread = isIncoming && roomId !== effectiveActiveRoomId;

      if (isIncoming) {
        socket?.emit(CHAT_EVENTS.RECEIVE, { messageId: message.messageId });
        if (roomId === effectiveActiveRoomId) {
          socket?.emit(CHAT_EVENTS.READ, { roomId });
        }
      }

      setMessages((prev) => ({
        ...prev,
        [roomId]: mergeMessages(prev[roomId], [message]),
      }));

      setRooms((prev) =>
        prev.map((room) =>
          room.id === roomId
            ? { ...room, preview: message.content, lastMessageAt: message.createdAt, age: toAgeLabel(message.createdAt), unreadCount: shouldIncreaseUnread ? room.unreadCount + 1 : room.unreadCount }
            : room,
        ),
      );
    },
    [currentUserId, effectiveActiveRoomId, roomByPeer, socket, setMessages, setRooms, reloadRooms],
  );

  const onGroupMessage = useCallback(
    (message: ChatMessage) => {
      const roomId = message.roomId ?? message.conversationId;
      if (!roomId) return;

      if (recentGroupCallLogIdsRef.current.has(message.messageId)) {
        recentGroupCallLogIdsRef.current.delete(message.messageId);
        return;
      }

      const shouldIncreaseUnread = message.senderId !== currentUserId && roomId !== effectiveActiveRoomId;

      setMessages((prev) => ({
        ...prev,
        [roomId]: mergeMessages(prev[roomId], [message]),
      }));

      setRooms((prev) =>
        prev.map((room) =>
          room.id === roomId
            ? { ...room, preview: toMessagePreview(message), lastMessageAt: message.createdAt, age: toAgeLabel(message.createdAt), unreadCount: shouldIncreaseUnread ? room.unreadCount + 1 : room.unreadCount }
            : room,
        ),
      );

      setGroupDetails((prev) => ({
        ...prev,
        [roomId]: {
          ...(prev[roomId] ?? {}),
          lastMessageAt: message.createdAt,
          lastMessagePreview: message.content,
        } as GroupRoomDetails,
      }));

      if (roomId === effectiveActiveRoomId) {
        socket?.emit(CHAT_EVENTS.GROUP_READ, { roomId });
      }
    },
    [currentUserId, effectiveActiveRoomId, socket, setMessages, setRooms, setGroupDetails],
  );

  const onRecalled = useCallback(
    (payload: MessageStateUpdate) => {
      const roomId =
        payload.roomId ?? (() => {
          const counterpartUserId = payload.senderId === currentUserId ? payload.receiverId : payload.senderId;
          return roomByPeer.get(counterpartUserId) ?? toPrivateRoomId(currentUserId, counterpartUserId);
        })();

      setMessages((prev) => ({
        ...prev,
        [roomId]: sortMessages((prev[roomId] ?? []).map((m) => (m.messageId === payload.messageId ? { ...m, isRecalled: true, updatedAt: payload.updatedAt ?? m.updatedAt } : m))),
      }));
    },
    [currentUserId, roomByPeer, setMessages],
  );

  const onReceived = useCallback(
    (payload: MessageStateUpdate) => {
      const roomId = payload.roomId ?? (() => {
        const counterpartUserId = payload.senderId === currentUserId ? payload.receiverId : payload.senderId;
        return roomByPeer.get(counterpartUserId) ?? toPrivateRoomId(currentUserId, counterpartUserId);
      })();

      setMessages((prev) => ({
        ...prev,
        [roomId]: sortMessages((prev[roomId] ?? []).map((m) => (m.messageId === payload.messageId ? { ...m, receivedAt: payload.receivedAt, updatedAt: payload.updatedAt ?? m.updatedAt } : m))),
      }));
    },
    [currentUserId, roomByPeer, setMessages],
  );

  const onTyping = useCallback(
    (payload: TypingPayload) => {
      const isGroup = Boolean(payload.roomId);
      const isCurrentRoom = isGroup ? payload.roomId === effectiveActiveRoomId : payload.senderId === peerUserId && payload.receiverId === currentUserId;
      if (!isCurrentRoom) return;

      setTypingText(payload.isTyping ? (isGroup ? "Có người đang nhập..." : "Typing...") : "");
      if (setTypingSenderId) setTypingSenderId(payload.isTyping ? payload.senderId : "");

      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = window.setTimeout(() => {
        setTypingText("");
        if (setTypingSenderId) setTypingSenderId("");
      }, 1500);
    },
    [effectiveActiveRoomId, peerUserId, currentUserId, setTypingText, setTypingSenderId],
  );

  const onPresence = useCallback(
    (payload: PresencePayload) => {
      setPresenceByUser((prev) => ({ ...prev, [payload.userId]: payload.isOnline }));
      setRooms((prev) => prev.map((r) => (r.roomType === "PRIVATE" && r.peerUserId === payload.userId ? { ...r, isPeerOnline: payload.isOnline } : r)));
    },
    [setPresenceByUser, setRooms],
  );

  const onGroupRoomUpdated = useCallback(
    (payload: GroupRoomDetails) => {
      setGroupDetails((prev) => ({ ...prev, [payload.roomId]: payload }));
      setRooms((prev) => prev.map((r) => (r.id === payload.roomId ? { ...r, title: payload.title, peerName: payload.title, avatarUrl: payload.avatarUrl, preview: payload.lastMessagePreview ?? r.preview, memberCount: payload.memberCount } : r)));
    },
    [setGroupDetails, setRooms],
  );

  const onGroupMemberLeft = useCallback(
    (payload: { roomId: string; userId: string; payload?: GroupRoomDetails }) => {
      if (payload.userId === currentUserId) {
        setRooms((prev) => prev.filter((r) => r.id !== payload.roomId));
        setGroupDetails((prev) => {
          const next = { ...prev };
          delete next[payload.roomId];
          return next;
        });
        return;
      }

      if (payload.payload) onGroupRoomUpdated(payload.payload);
      setGroupDetails((prev) => ({ ...prev, [payload.roomId]: { ...(prev[payload.roomId] ?? {}), members: (prev[payload.roomId]?.members ?? []).filter((m) => m.userId !== payload.userId) } as GroupRoomDetails }));
    },
    [currentUserId, onGroupRoomUpdated, setRooms, setGroupDetails],
  );

  const onGroupCallStarted = useCallback(
    async (payload: GroupCallStartedPayload) => {
      // Debug: trace start events and local rejoinable state
      try {
        // eslint-disable-next-line no-console
        console.debug("GROUP_CALL_STARTED received", { payload, rejoinable: props.rejoinableGroupCall });
      } catch {}
      try {
        await ensureGroupDetails(payload.roomId);
      } catch {}

      if (payload.senderId === currentUserId) {
        setPendingGroupCall(null);
        setGroupCallRoomId(payload.roomId);
        setGroupCallMode(payload.callMode);
        setGroupCallDirection("outgoing");
        setGroupCallHostUserId(currentUserId);
        return;
      }

      if (props.groupCallRoomId === payload.roomId) {
        return;
      }

      if (props.pendingGroupCall?.roomId === payload.roomId) {
        return;
      }

      if (props.rejoinableGroupCall?.roomId === payload.roomId) {
        // If we have a local rejoinable record for this room, ignore incoming starts.
        return;
      }

      setGroupCallRoomId("");
      setGroupCallMode(null);
      setGroupCallDirection(null);
      setGroupCallHostUserId("");
      setPendingGroupCall({ roomId: payload.roomId, callMode: payload.callMode, senderId: payload.senderId });
    },
    [
      currentUserId,
      ensureGroupDetails,
      props.groupCallRoomId,
      props.pendingGroupCall,
      props.rejoinableGroupCall,
      setGroupCallRoomId,
      setGroupCallMode,
      setGroupCallDirection,
      setGroupCallHostUserId,
      setPendingGroupCall,
    ],
  );

  const onGroupCallEnded = useCallback(
    (payload: GroupCallEndPayload) => {
      try {
        // eslint-disable-next-line no-console
        console.debug("GROUP_CALL_END received", { payload, rejoinable: props.rejoinableGroupCall });
      } catch {}
      const isActiveCallRoom = props.groupCallRoomId === payload.roomId;
      const isPendingCallRoom = props.pendingGroupCall?.roomId === payload.roomId;
      const isRejoinableCallRoom = props.rejoinableGroupCall?.roomId === payload.roomId;

      if (!isActiveCallRoom && !isPendingCallRoom && !isRejoinableCallRoom) return;

      if (payload.callLogMessage) {
        const callLogMessage = payload.callLogMessage;
        const roomId = callLogMessage.roomId ?? payload.roomId;
        recentGroupCallLogIdsRef.current.add(callLogMessage.messageId);

        setMessages((prev) => ({
          ...prev,
          [roomId]: mergeMessages(prev[roomId], [callLogMessage]),
        }));

        setRooms((prev) =>
          prev.map((room) =>
            room.id === roomId
              ? {
                  ...room,
                  preview: toMessagePreview(callLogMessage),
                  lastMessageAt: callLogMessage.createdAt,
                  age: toAgeLabel(callLogMessage.createdAt),
                  unreadCount:
                    payload.senderId !== currentUserId && roomId !== effectiveActiveRoomId
                      ? room.unreadCount + 1
                      : room.unreadCount,
                }
              : room,
          ),
        );

        setGroupDetails((prev) => ({
          ...prev,
          [roomId]: {
            ...(prev[roomId] ?? {}),
            lastMessageAt: callLogMessage.createdAt,
            lastMessagePreview: callLogMessage.content,
          } as GroupRoomDetails,
        }));
      }

      if (!payload.endForAll && payload.senderId !== currentUserId) {
        return;
      }

      if (!payload.endForAll && payload.senderId === currentUserId) {
        setRejoinableGroupCall({
          roomId: payload.roomId,
          callMode: payload.callMode ?? "voice",
          callHostUserId: props.groupCallHostUserId || currentUserId,
        });
      }

      if (payload.endForAll) {
        setRejoinableGroupCall(null);
      }

      setGroupCallRoomId("");
      setGroupCallMode(null);
      setGroupCallDirection(null);
      setGroupCallHostUserId("");
      setPendingGroupCall(null);
    },
    [
      currentUserId,
      props.groupCallRoomId,
      props.pendingGroupCall,
      props.rejoinableGroupCall,
      effectiveActiveRoomId,
      setGroupDetails,
      setGroupCallRoomId,
      setGroupCallMode,
      setGroupCallDirection,
      setGroupCallHostUserId,
      setMessages,
      setRooms,
      setPendingGroupCall,
      setRejoinableGroupCall,
    ],
  );

  const onIncomingCall = useCallback((payload: IncomingCallState) => setIncomingCall(payload), [setIncomingCall]);
  const onCallEnd = useCallback((payload: CallEndPayload) => {
    // clear incoming call state when call ends
    setIncomingCall(null);
  }, [setIncomingCall]);

  const onReaction = useCallback((payload: ReactionPayload) => {
    const roomId = payload.roomId ?? payload.messageId?.split(":")[0] ?? "";
    if (!roomId) return;

    setMessages((prev) => {
      const updated = (prev[roomId] ?? []).map((m) => {
        if (m.messageId !== payload.messageId) return m;
        const reactions = { ...(m.reactions ?? {}) } as Record<string, string[]>;
        // remove previous
        Object.keys(reactions).forEach((k) => {
          reactions[k] = reactions[k].filter((id) => id !== payload.userId);
          if (reactions[k].length === 0) delete reactions[k];
        });
        if (!reactions[payload.emoji]) reactions[payload.emoji] = [];
        if (!reactions[payload.emoji].includes(payload.userId)) reactions[payload.emoji].push(payload.userId);
        const reactionOrder = [payload.emoji, ...Object.keys(reactions).filter((e) => e !== payload.emoji)].slice(0, 3);
        return { ...m, reactions, reactionOrder };
      });
      return { ...prev, [roomId]: updated };
    });
  }, [setMessages]);

  useEffect(() => {
    if (!socket) return;

    socket.on(CHAT_EVENTS.MESSAGE, onMessage);
    socket.on(CHAT_EVENTS.GROUP_MESSAGE, onGroupMessage);
    socket.on(CHAT_EVENTS.RECALLED, onRecalled);
    socket.on(CHAT_EVENTS.RECEIVED, onReceived);
    socket.on(CHAT_EVENTS.PRESENCE, onPresence);
    socket.on(CHAT_EVENTS.TYPING, onTyping);
    socket.on(CHAT_EVENTS.GROUP_TYPING, onTyping);
    socket.on(CHAT_EVENTS.GROUP_ROOM_UPDATED, onGroupRoomUpdated);
    socket.on(CHAT_EVENTS.GROUP_MEMBER_LEFT, onGroupMemberLeft);
    socket.on(CHAT_EVENTS.GROUP_CALL_STARTED, onGroupCallStarted);
    socket.on(CHAT_EVENTS.GROUP_CALL_END, onGroupCallEnded);
    socket.on(CHAT_EVENTS.GROUP_DISSOLVED, onGroupRoomUpdated);
    socket.on(CHAT_EVENTS.REACTION, onReaction as any);
    socket.on(CALL_EVENTS.INCOMING, onIncomingCall);
    socket.on(CALL_EVENTS.END, onCallEnd);

    return () => {
      socket.off(CHAT_EVENTS.MESSAGE, onMessage);
      socket.off(CHAT_EVENTS.GROUP_MESSAGE, onGroupMessage);
      socket.off(CHAT_EVENTS.RECALLED, onRecalled);
      socket.off(CHAT_EVENTS.RECEIVED, onReceived);
      socket.off(CHAT_EVENTS.PRESENCE, onPresence);
      socket.off(CHAT_EVENTS.TYPING, onTyping);
      socket.off(CHAT_EVENTS.GROUP_TYPING, onTyping);
      socket.off(CHAT_EVENTS.GROUP_ROOM_UPDATED, onGroupRoomUpdated);
      socket.off(CHAT_EVENTS.GROUP_MEMBER_LEFT, onGroupMemberLeft);
      socket.off(CHAT_EVENTS.GROUP_CALL_STARTED, onGroupCallStarted);
      socket.off(CHAT_EVENTS.GROUP_CALL_END, onGroupCallEnded);
      socket.off(CHAT_EVENTS.GROUP_DISSOLVED, onGroupRoomUpdated);
      socket.off(CHAT_EVENTS.REACTION, onReaction as any);
      socket.off(CALL_EVENTS.INCOMING, onIncomingCall);
      socket.off(CALL_EVENTS.END, onCallEnd);
    };
  }, [socket, onMessage, onGroupMessage, onRecalled, onReceived, onPresence, onTyping, onGroupRoomUpdated, onGroupMemberLeft, onGroupCallStarted, onGroupCallEnded, onReaction, onIncomingCall, onCallEnd]);
}
