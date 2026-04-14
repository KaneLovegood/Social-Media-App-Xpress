"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { getAccessToken } from "@/lib/auth-client";
import { leaveGroup } from "@/lib/chat-groups";
import { dissolveGroup } from "@/lib/chat-groups";
import { fetchGroupRoomDetails, GroupRoomDetails } from "@/lib/chat-groups";
import { sendChatAction } from "@/lib/chat-actions";
import { fetchChatRoomMessages } from "@/lib/chat-messages";
import { ChatRoomSummary, fetchChatRooms } from "@/lib/chat-rooms";
import { CALL_EVENTS, CHAT_EVENTS } from "@/lib/realtime/events";
import { createChatSocket } from "@/lib/realtime/socket-client";
import {
  CallEndPayload,
  ChatMessage,
  GroupCallAnswerPayload,
  GroupCallEndPayload,
  GroupCallIcePayload,
  GroupCallOfferPayload,
  GroupCallStartedPayload,
  MessageStateUpdate,
  PresencePayload,
  ReplyPreview,
  TypingPayload,
} from "@/lib/realtime/types";
import IncomingCallModal from "./IncomingCallModal";
import IncomingGroupCallModal from "./IncomingGroupCallModal";
import ChatInfoPanel from "./ChatInfoPanel";
import CreateGroupModal from "./CreateGroupModal";
import VideoCallComponent from "../video/VideoCallComponent";
import GroupCallComponent from "../video/GroupCallComponent";
import ChatHeader from "./ChatHeader";
import ChatNoRoomWelcome from "./ChatNoRoomWelcome";
import ChatSidebar, { SidebarChatItem } from "./ChatSidebar";
import MessageInput from "./MessageInput";
import MessageList from "./MessageList";

type CallMode = "voice" | "video" | null;
type CallDirection = "incoming" | "outgoing" | null;

function getClearHistoryStorageKey(userId: string): string {
  return `xpress.chat.cleared.${userId}`;
}

function toPrivateRoomId(userAId: string, userBId: string): string {
  const [first, second] = [userAId, userBId].sort();
  return `${first}:${second}`;
}

function toAgeLabel(isoTimestamp: string): string {
  const at = new Date(isoTimestamp).getTime();
  if (Number.isNaN(at)) return "Now";

  const deltaMs = Math.max(0, Date.now() - at);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (deltaMs < minute) return "Now";
  if (deltaMs < hour) return `${Math.floor(deltaMs / minute)}m ago`;
  if (deltaMs < day) return `${Math.floor(deltaMs / hour)}h ago`;
  return `${Math.floor(deltaMs / day)}d ago`;
}

function sortMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((first, second) => {
    const timeDiff = first.createdAt.localeCompare(second.createdAt);
    if (timeDiff !== 0) return timeDiff;

    return first.messageId.localeCompare(second.messageId);
  });
}

function mergeMessages(
  existing: ChatMessage[] = [],
  incoming: ChatMessage[] = [],
): ChatMessage[] {
  const merged = new Map<string, ChatMessage>();

  for (const message of existing) {
    merged.set(message.messageId, message);
  }

  for (const message of incoming) {
    merged.set(message.messageId, message);
  }

  return sortMessages(Array.from(merged.values()));
}

interface ChatContainerProps {
  currentUserId: string;
  currentUserName: string;
  initialRoomId?: string;
  initialPeerUserId?: string;
}

export default function ChatContainer({
  currentUserId,
  currentUserName,
  initialRoomId,
  initialPeerUserId,
}: ChatContainerProps) {
  const [rooms, setRooms] = useState<ChatRoomSummary[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [activeRoomId, setActiveRoomId] = useState("");
  const [messagesByRoom, setMessagesByRoom] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [loadedRoomIds, setLoadedRoomIds] = useState<Record<string, boolean>>(
    {},
  );
  const [replyTo, setReplyTo] = useState<ReplyPreview | undefined>(undefined);
  const [typingText, setTypingText] = useState("");
  const [groupDetailsByRoom, setGroupDetailsByRoom] = useState<
    Record<string, GroupRoomDetails>
  >({});
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [callMode, setCallMode] = useState<CallMode>(null);
  const [callDirection, setCallDirection] = useState<CallDirection>(null);
  const [groupCallRoomId, setGroupCallRoomId] = useState("");
  const [groupCallMode, setGroupCallMode] = useState<CallMode>(null);
  const [groupCallDirection, setGroupCallDirection] =
    useState<CallDirection>(null);
  const [pendingGroupCall, setPendingGroupCall] = useState<{
    roomId: string;
    callMode: "voice" | "video";
    senderId: string;
  } | null>(null);
  const [incomingCall, setIncomingCall] = useState<{
    senderId: string;
    senderName: string;
    callMode: "voice" | "video";
    sessionId: string;
    isOnline: boolean;
  } | null>(null);
  const [presenceByUser, setPresenceByUser] = useState<Record<string, boolean>>(
    {},
  );
  const [clearedRoomAtById, setClearedRoomAtById] = useState<
    Record<string, string>
  >({});
  const [isClearHistoryHydrated, setIsClearHistoryHydrated] = useState(false);
  const typingTimeoutRef = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const token = useMemo(() => getAccessToken(), []);

  useEffect(() => {
    if (typeof window === "undefined") {
      setIsClearHistoryHydrated(true);
      return;
    }

    const raw = window.localStorage.getItem(
      getClearHistoryStorageKey(currentUserId),
    );
    if (!raw) {
      setClearedRoomAtById({});
      setIsClearHistoryHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      setClearedRoomAtById(parsed ?? {});
    } catch {
      setClearedRoomAtById({});
    }

    setIsClearHistoryHydrated(true);
  }, [currentUserId]);

  useEffect(() => {
    if (typeof window === "undefined" || !isClearHistoryHydrated) {
      return;
    }

    window.localStorage.setItem(
      getClearHistoryStorageKey(currentUserId),
      JSON.stringify(clearedRoomAtById),
    );
  }, [clearedRoomAtById, currentUserId, isClearHistoryHydrated]);

  const reloadRooms = useCallback(async () => {
    setIsLoadingRooms(true);
    try {
      const fetchedRooms = await fetchChatRooms();
      setRooms(fetchedRooms);
      setPresenceByUser(
        fetchedRooms.reduce<Record<string, boolean>>((acc, room) => {
          acc[room.peerUserId] = room.isPeerOnline;
          return acc;
        }, {}),
      );
    } finally {
      setIsLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      socketRef.current = null;
      return;
    }

    if (!socketRef.current) {
      socketRef.current = createChatSocket(token);
    }
  }, [token]);

  useEffect(() => {
    let mounted = true;

    void reloadRooms().catch(() => {
      if (!mounted) return;
      setRooms([]);
      setIsLoadingRooms(false);
    });

    return () => {
      mounted = false;
    };
  }, [reloadRooms]);

  const effectiveActiveRoomId = useMemo(
    () => (rooms.some((room) => room.id === activeRoomId) ? activeRoomId : ""),
    [activeRoomId, rooms],
  );

  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === effectiveActiveRoomId) ?? null,
    [effectiveActiveRoomId, rooms],
  );
  const activeGroupDetails =
    activeRoom?.roomType === "GROUP"
      ? (groupDetailsByRoom[activeRoom.id] ?? null)
      : null;
  const activeGroupCallDetails = groupCallRoomId
    ? (groupDetailsByRoom[groupCallRoomId] ?? null)
    : null;
  const peerUserId =
    activeRoom?.roomType === "GROUP" ? "" : (activeRoom?.peerUserId ?? "");
  const peerName = activeRoom?.peerName ?? "User";
  const orderTitle =
    activeRoom?.roomType === "GROUP"
      ? (activeGroupDetails?.description ??
        `${activeGroupDetails?.memberCount ?? activeRoom?.memberCount ?? 0} thành viên`)
      : (activeRoom?.title ?? "No active room");
  const isPeerOnline = peerUserId
    ? (presenceByUser[peerUserId] ?? activeRoom?.isPeerOnline ?? false)
    : false;
  const hasRooms = rooms.length > 0;
  const activeMessages = useMemo(() => {
    if (!effectiveActiveRoomId) {
      return [];
    }

    const baseMessages = messagesByRoom[effectiveActiveRoomId] ?? [];
    const clearedAt = clearedRoomAtById[effectiveActiveRoomId];
    if (!clearedAt) {
      return baseMessages;
    }

    const clearedAtTs = Date.parse(clearedAt);
    if (Number.isNaN(clearedAtTs)) {
      return baseMessages;
    }

    return baseMessages.filter((message) => {
      const messageTs = Date.parse(message.createdAt);
      if (Number.isNaN(messageTs)) {
        return true;
      }

      return messageTs > clearedAtTs;
    });
  }, [clearedRoomAtById, effectiveActiveRoomId, messagesByRoom]);

  const roomByPeer = useMemo(
    () => new Map(rooms.map((room) => [room.peerUserId, room.id])),
    [rooms],
  );

  const sidebarRooms = useMemo<SidebarChatItem[]>(
    () =>
      rooms.map((room) => {
        const clearedAt = clearedRoomAtById[room.id];
        const hasHiddenHistory =
          typeof clearedAt === "string" &&
          Date.parse(room.lastMessageAt) <= Date.parse(clearedAt);

        return {
          id: room.id,
          roomType: room.roomType,
          title: room.title,
          preview: hasHiddenHistory ? "Đã xóa lịch sử" : room.preview,
          age: room.age,
          unreadCount: hasHiddenHistory ? 0 : room.unreadCount,
          isOnline:
            room.roomType === "GROUP"
              ? false
              : (presenceByUser[room.peerUserId] ?? room.isPeerOnline),
        };
      }),
    [clearedRoomAtById, presenceByUser, rooms],
  );

  const handleSelectRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    setReplyTo(undefined);
    setTypingText("");
  };

  const ensureGroupDetails = useCallback(
    async (roomId: string) => {
      const existing = groupDetailsByRoom[roomId];
      if (existing) {
        return existing;
      }

      const details = await fetchGroupRoomDetails(roomId);
      setGroupDetailsByRoom((prev) => ({
        ...prev,
        [details.roomId]: details,
      }));
      return details;
    },
    [groupDetailsByRoom],
  );

  useEffect(() => {
    if (rooms.length === 0) return;

    if (activeRoomId && rooms.some((room) => room.id === activeRoomId)) {
      return;
    }

    if (initialRoomId && rooms.some((room) => room.id === initialRoomId)) {
      setActiveRoomId(initialRoomId);
      return;
    }

    if (initialPeerUserId) {
      const room = rooms.find((item) => item.peerUserId === initialPeerUserId);
      if (room) {
        setActiveRoomId(room.id);
      }
    }
  }, [activeRoomId, initialPeerUserId, initialRoomId, rooms]);

  useEffect(() => {
    if (!effectiveActiveRoomId || loadedRoomIds[effectiveActiveRoomId]) {
      return;
    }

    let cancelled = false;

    void fetchChatRoomMessages(effectiveActiveRoomId)
      .then((fetchedMessages) => {
        if (cancelled) return;

        setMessagesByRoom((prev) => ({
          ...prev,
          [effectiveActiveRoomId]: mergeMessages(
            prev[effectiveActiveRoomId],
            fetchedMessages,
          ),
        }));
      })
      .catch(() => {
        if (cancelled) return;

        setMessagesByRoom((prev) => ({
          ...prev,
          [effectiveActiveRoomId]: prev[effectiveActiveRoomId] ?? [],
        }));
      })
      .finally(() => {
        if (cancelled) return;

        setLoadedRoomIds((prev) => ({
          ...prev,
          [effectiveActiveRoomId]: true,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveActiveRoomId, loadedRoomIds]);

  useEffect(() => {
    if (!activeRoom || activeRoom.roomType !== "GROUP") {
      return;
    }

    if (groupDetailsByRoom[activeRoom.id]) {
      return;
    }

    let cancelled = false;

    void fetchGroupRoomDetails(activeRoom.id)
      .then((details) => {
        if (cancelled) return;
        setGroupDetailsByRoom((prev) => ({
          ...prev,
          [details.roomId]: details,
        }));
      })
      .catch(() => {
        if (cancelled) return;
      });

    return () => {
      cancelled = true;
    };
  }, [activeRoom, groupDetailsByRoom]);

  useEffect(() => {
    if (!effectiveActiveRoomId || !socketRef.current) return;

    socketRef.current.emit(CHAT_EVENTS.READ, {
      roomId: effectiveActiveRoomId,
    });

    setRooms((prev) =>
      prev.map((room) =>
        room.id === effectiveActiveRoomId ? { ...room, unreadCount: 0 } : room,
      ),
    );

    if (activeRoom?.roomType === "GROUP") {
      socketRef.current.emit(CHAT_EVENTS.GROUP_READ, {
        roomId: effectiveActiveRoomId,
      });
    }
  }, [effectiveActiveRoomId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onMessage = (message: ChatMessage) => {
      const isPrivateConversation =
        message.roomType === "PRIVATE" || message.conversationId.includes(":");
      if (message.roomType === "GROUP" || !isPrivateConversation) {
        return;
      }

      const counterpartUserId =
        message.senderId === currentUserId
          ? message.receiverId
          : message.senderId;
      let roomId = roomByPeer.get(counterpartUserId);

      if (!roomId) {
        roomId = toPrivateRoomId(currentUserId, counterpartUserId);
      }

      const isIncoming = message.receiverId === currentUserId;
      const shouldIncreaseUnread =
        isIncoming && roomId !== effectiveActiveRoomId;

      if (isIncoming) {
        socket.emit(CHAT_EVENTS.RECEIVE, { messageId: message.messageId });

        if (roomId === effectiveActiveRoomId) {
          socket.emit(CHAT_EVENTS.READ, { roomId });
        }
      }

      setMessagesByRoom((prev) => {
        return {
          ...prev,
          [roomId]: mergeMessages(prev[roomId], [message]),
        };
      });

      setRooms((prev) => {
        const existed = prev.find((room) => room.id === roomId);
        if (!existed) {
          void reloadRooms().catch(() => {
            // Keep current sidebar state when refresh fails.
          });
          return prev;
        }

        return prev.map((room) => {
          if (room.id !== roomId) return room;
          return {
            ...room,
            preview: message.content,
            lastMessageAt: message.createdAt,
            age: toAgeLabel(message.createdAt),
            unreadCount: shouldIncreaseUnread
              ? room.unreadCount + 1
              : room.unreadCount,
          };
        });
      });
    };

    const onGroupMessage = (message: ChatMessage) => {
      const roomId = message.roomId ?? message.conversationId;
      if (!roomId) return;

      const shouldIncreaseUnread =
        message.senderId !== currentUserId && roomId !== effectiveActiveRoomId;

      setMessagesByRoom((prev) => ({
        ...prev,
        [roomId]: mergeMessages(prev[roomId], [message]),
      }));

      setRooms((prev) => {
        const existed = prev.find((room) => room.id === roomId);

        if (!existed) {
          void reloadRooms().catch(() => {
            // Keep current sidebar state when refresh fails.
          });
          return prev;
        }

        return prev.map((room) => {
          if (room.id !== roomId) return room;
          return {
            ...room,
            preview: message.content,
            lastMessageAt: message.createdAt,
            age: toAgeLabel(message.createdAt),
            unreadCount: shouldIncreaseUnread
              ? room.unreadCount + 1
              : room.unreadCount,
          };
        });
      });

      setGroupDetailsByRoom((prev) => {
        const existed = prev[roomId];
        if (!existed) return prev;

        return {
          ...prev,
          [roomId]: {
            ...existed,
            lastMessageAt: message.createdAt,
            lastMessagePreview: message.content,
          },
        };
      });

      if (roomId === effectiveActiveRoomId) {
        socket.emit(CHAT_EVENTS.GROUP_READ, { roomId });
      }
    };

    const onRecalled = (payload: MessageStateUpdate) => {
      const roomId =
        payload.roomId ??
        (() => {
          const counterpartUserId =
            payload.senderId === currentUserId
              ? payload.receiverId
              : payload.senderId;
          return (
            roomByPeer.get(counterpartUserId) ??
            toPrivateRoomId(currentUserId, counterpartUserId)
          );
        })();

      setMessagesByRoom((prev) => ({
        ...prev,
        [roomId]: sortMessages(
          (prev[roomId] ?? []).map((message) =>
            message.messageId === payload.messageId
              ? {
                  ...message,
                  isRecalled: true,
                  updatedAt: payload.updatedAt ?? message.updatedAt,
                }
              : message,
          ),
        ),
      }));
    };

    const onReceived = (payload: MessageStateUpdate) => {
      const roomId =
        payload.roomId ??
        (() => {
          const counterpartUserId =
            payload.senderId === currentUserId
              ? payload.receiverId
              : payload.senderId;
          return (
            roomByPeer.get(counterpartUserId) ??
            toPrivateRoomId(currentUserId, counterpartUserId)
          );
        })();

      setMessagesByRoom((prev) => ({
        ...prev,
        [roomId]: sortMessages(
          (prev[roomId] ?? []).map((message) =>
            message.messageId === payload.messageId
              ? {
                  ...message,
                  receivedAt: payload.receivedAt,
                  updatedAt: payload.updatedAt ?? message.updatedAt,
                }
              : message,
          ),
        ),
      }));
    };

    const onTyping = (payload: TypingPayload) => {
      const isGroupTyping = Boolean(payload.roomId);
      const isCurrentRoom = isGroupTyping
        ? payload.roomId === effectiveActiveRoomId
        : payload.senderId === peerUserId &&
          payload.receiverId === currentUserId;

      if (!isCurrentRoom) return;

      setTypingText(
        payload.isTyping
          ? isGroupTyping
            ? "Có người đang nhập..."
            : "Typing..."
          : "",
      );

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = window.setTimeout(() => {
        setTypingText("");
      }, 1500);
    };

    const onGroupRoomUpdated = (payload: GroupRoomDetails) => {
      setGroupDetailsByRoom((prev) => ({
        ...prev,
        [payload.roomId]: payload,
      }));

      setRooms((prev) => {
        const existed = prev.find((room) => room.id === payload.roomId);
        const nextItem: ChatRoomSummary = {
          id: payload.roomId,
          roomType: "GROUP",
          title: payload.title,
          peerUserId: payload.roomId,
          peerName: payload.title,
          avatarUrl: payload.avatarUrl,
          description: payload.description,
          emoji: payload.emoji,
          memberCount: payload.memberCount,
          preview:
            payload.lastMessagePreview ??
            existed?.preview ??
            "Bắt đầu trò chuyện trong nhóm",
          lastMessageAt:
            payload.lastMessageAt ??
            existed?.lastMessageAt ??
            new Date().toISOString(),
          age: payload.lastMessageAt
            ? toAgeLabel(payload.lastMessageAt)
            : (existed?.age ?? "Now"),
          unreadCount: existed?.unreadCount ?? 0,
          isPeerOnline: false,
        };

        if (!existed) {
          return [nextItem, ...prev];
        }

        return prev.map((room) =>
          room.id === payload.roomId ? { ...room, ...nextItem } : room,
        );
      });
    };

    const onGroupMemberLeft = (payload: {
      roomId: string;
      userId: string;
      payload?: GroupRoomDetails;
    }) => {
      if (payload.payload) {
        onGroupRoomUpdated(payload.payload);
      }
      setGroupDetailsByRoom((prev) => {
        const existing = prev[payload.roomId];
        if (!existing) return prev;

        return {
          ...prev,
          [payload.roomId]: {
            ...existing,
            members: existing.members.filter(
              (member) => member.userId !== payload.userId,
            ),
            memberCount: Math.max(0, existing.memberCount - 1),
          },
        };
      });
    };

    const onGroupCallStarted = async (payload: GroupCallStartedPayload) => {
      if (
        payload.roomId === groupCallRoomId &&
        groupCallMode === payload.callMode
      ) {
        return;
      }

      try {
        await ensureGroupDetails(payload.roomId);
      } catch {
        return;
      }

      setCallMode(null);
      setCallDirection(null);
      setIncomingCall(null);
      if (payload.senderId === currentUserId) {
        setPendingGroupCall(null);
        setGroupCallRoomId(payload.roomId);
        setGroupCallMode(payload.callMode);
        setGroupCallDirection("outgoing");
        return;
      }

      setGroupCallRoomId("");
      setGroupCallMode(null);
      setGroupCallDirection(null);
      setPendingGroupCall({
        roomId: payload.roomId,
        callMode: payload.callMode,
        senderId: payload.senderId,
      });
    };

    const onGroupCallEnded = (payload: GroupCallEndPayload) => {
      if (payload.roomId !== groupCallRoomId) {
        if (pendingGroupCall?.roomId !== payload.roomId) {
          return;
        }
      }

      setGroupCallRoomId("");
      setGroupCallMode(null);
      setGroupCallDirection(null);
      setPendingGroupCall(null);
    };

    const onGroupDissolved = (payload: { roomId: string }) => {
      setRooms((prev) => prev.filter((room) => room.id !== payload.roomId));
      setGroupDetailsByRoom((prev) => {
        if (!prev[payload.roomId]) return prev;

        const next = { ...prev };
        delete next[payload.roomId];
        return next;
      });

      if (activeRoomId === payload.roomId) {
        setActiveRoomId("");
      }

      if (groupCallRoomId === payload.roomId) {
        setGroupCallRoomId("");
        setGroupCallMode(null);
        setGroupCallDirection(null);
        setPendingGroupCall(null);
      }
    };

    const onIncomingCall = (payload: {
      senderId: string;
      senderName: string;
      callMode: "voice" | "video";
      sessionId: string;
      isOnline: boolean;
    }) => {
      setIncomingCall(payload);
    };

    const onCallEnd = (payload: CallEndPayload) => {
      if (payload.receiverId !== currentUserId) return;

      setIncomingCall((prev) => {
        if (!prev || prev.senderId !== payload.senderId) {
          return prev;
        }

        return null;
      });
    };

    const onPresence = (payload: PresencePayload) => {
      setPresenceByUser((prev) => ({
        ...prev,
        [payload.userId]: payload.isOnline,
      }));

      setRooms((prev) =>
        prev.map((room) =>
          room.roomType === "PRIVATE" && room.peerUserId === payload.userId
            ? { ...room, isPeerOnline: payload.isOnline }
            : room,
        ),
      );

      setGroupDetailsByRoom((prev) => {
        let changed = false;
        const next: Record<string, GroupRoomDetails> = { ...prev };

        for (const [roomId, details] of Object.entries(prev)) {
          const updatedMembers = details.members.map((member) => {
            if (
              member.userId !== payload.userId ||
              member.isOnline === payload.isOnline
            ) {
              return member;
            }

            changed = true;
            return {
              ...member,
              isOnline: payload.isOnline,
            };
          });

          if (changed) {
            next[roomId] = {
              ...details,
              members: updatedMembers,
            };
          }
        }

        return changed ? next : prev;
      });
    };

    socket.on(CHAT_EVENTS.MESSAGE, onMessage);
    socket.on(CHAT_EVENTS.GROUP_MESSAGE, onGroupMessage);
    socket.on(CHAT_EVENTS.RECALLED, onRecalled);
    socket.on(CHAT_EVENTS.RECEIVED, onReceived);
    socket.on(CHAT_EVENTS.PRESENCE, onPresence);
    socket.on(CHAT_EVENTS.TYPING, onTyping);
    socket.on(CHAT_EVENTS.GROUP_ROOM_UPDATED, onGroupRoomUpdated);
    socket.on(CHAT_EVENTS.GROUP_MEMBER_LEFT, onGroupMemberLeft);
    socket.on(CHAT_EVENTS.GROUP_CALL_STARTED, onGroupCallStarted);
    socket.on(CHAT_EVENTS.GROUP_CALL_END, onGroupCallEnded);
    socket.on(CHAT_EVENTS.GROUP_DISSOLVED, onGroupDissolved);
    socket.on(CALL_EVENTS.INCOMING, onIncomingCall);
    socket.on(CALL_EVENTS.END, onCallEnd);

    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      socket.off(CHAT_EVENTS.MESSAGE, onMessage);
      socket.off(CHAT_EVENTS.GROUP_MESSAGE, onGroupMessage);
      socket.off(CHAT_EVENTS.RECALLED, onRecalled);
      socket.off(CHAT_EVENTS.RECEIVED, onReceived);
      socket.off(CHAT_EVENTS.PRESENCE, onPresence);
      socket.off(CHAT_EVENTS.TYPING, onTyping);
      socket.off(CHAT_EVENTS.GROUP_ROOM_UPDATED, onGroupRoomUpdated);
      socket.off(CHAT_EVENTS.GROUP_MEMBER_LEFT, onGroupMemberLeft);
      socket.off(CHAT_EVENTS.GROUP_CALL_STARTED, onGroupCallStarted);
      socket.off(CHAT_EVENTS.GROUP_CALL_END, onGroupCallEnded);
      socket.off(CHAT_EVENTS.GROUP_DISSOLVED, onGroupDissolved);
      socket.off(CALL_EVENTS.INCOMING, onIncomingCall);
      socket.off(CALL_EVENTS.END, onCallEnd);
    };
  }, [
    currentUserId,
    effectiveActiveRoomId,
    activeRoomId,
    peerName,
    peerUserId,
    presenceByUser,
    ensureGroupDetails,
    groupCallMode,
    groupCallRoomId,
    pendingGroupCall,
    roomByPeer,
    reloadRooms,
  ]);

  useEffect(() => {
    const listElement = listRef.current;
    if (!listElement) return;
    listElement.scrollTo({
      top: listElement.scrollHeight,
      behavior: "smooth",
    });
  }, [activeMessages]);

  const handleSend = (content: string) => {
    if (!socketRef.current || !effectiveActiveRoomId) return;

    if (activeRoom?.roomType === "GROUP") {
      socketRef.current.emit(CHAT_EVENTS.GROUP_SEND, {
        roomId: effectiveActiveRoomId,
        content,
      });
      return;
    }

    if (!peerUserId) return;

    if (replyTo) {
      socketRef.current.emit(CHAT_EVENTS.REPLY, {
        receiverId: peerUserId,
        content,
        replyToMessageId: replyTo.messageId,
      });
      setReplyTo(undefined);
      return;
    }

    socketRef.current.emit(CHAT_EVENTS.SEND, {
      receiverId: peerUserId,
      content,
    });
  };

  const handleRecall = (messageId: string) => {
    socketRef.current?.emit(CHAT_EVENTS.RECALL, { messageId });
  };

  const handleTyping = (isTyping: boolean) => {
    if (!effectiveActiveRoomId || !socketRef.current) return;

    if (activeRoom?.roomType === "GROUP") {
      socketRef.current.emit(CHAT_EVENTS.GROUP_TYPING, {
        roomId: effectiveActiveRoomId,
        isTyping,
      });
      return;
    }

    if (!peerUserId) return;
    socketRef.current?.emit(CHAT_EVENTS.TYPING, {
      receiverId: peerUserId,
      isTyping,
    });
  };

  const openVoiceCall = () => {
    if (!peerUserId) return;
    setCallDirection("outgoing");
    setCallMode("voice");
    void sendChatAction("open_voice_call", {
      peerUserId,
      metadata: { triggeredBy: currentUserId },
    });
  };

  const openVideoCall = () => {
    if (!peerUserId) return;
    setCallDirection("outgoing");
    setCallMode("video");
    void sendChatAction("open_video_call", {
      peerUserId,
      metadata: { triggeredBy: currentUserId },
    });
  };

  const startGroupCall = useCallback(
    async (mode: "voice" | "video") => {
      if (
        !socketRef.current ||
        !activeRoom ||
        activeRoom.roomType !== "GROUP"
      ) {
        return;
      }

      if (
        groupCallRoomId === activeRoom.id &&
        groupCallMode === mode &&
        groupCallDirection
      ) {
        return;
      }

      await ensureGroupDetails(activeRoom.id);
      setCallMode(null);
      setCallDirection(null);
      setIncomingCall(null);
      setGroupCallRoomId(activeRoom.id);
      setGroupCallMode(mode);
      setGroupCallDirection("outgoing");

      socketRef.current.emit(CHAT_EVENTS.GROUP_CALL_START, {
        roomId: activeRoom.id,
        callMode: mode,
      });
    },
    [
      activeRoom,
      ensureGroupDetails,
      groupCallDirection,
      groupCallMode,
      groupCallRoomId,
    ],
  );

  const handleOpenVoiceCall = () => {
    if (activeRoom?.roomType === "GROUP") {
      void startGroupCall("voice");
      return;
    }

    openVoiceCall();
  };

  const handleOpenVideoCall = () => {
    if (activeRoom?.roomType === "GROUP") {
      void startGroupCall("video");
      return;
    }

    openVideoCall();
  };

  const handleAcceptIncomingCall = () => {
    if (!incomingCall) return;
    setCallDirection("incoming");
    setCallMode(incomingCall.callMode);
    setIncomingCall(null);
    void sendChatAction("accept_call", {
      peerUserId: incomingCall.senderId,
      metadata: { sessionId: incomingCall.sessionId },
    });
  };

  const handleDeclineIncomingCall = () => {
    if (!incomingCall) return;
    socketRef.current?.emit(CALL_EVENTS.END, {
      receiverId: incomingCall.senderId,
      reason: "declined",
    });
    setIncomingCall(null);
    setCallDirection(null);
    setCallMode(null);
    void sendChatAction("decline_call", {
      peerUserId: incomingCall.senderId,
      metadata: { sessionId: incomingCall.sessionId },
    });
  };

  const handleCloseCall = useCallback(() => {
    setCallMode(null);
    setCallDirection(null);
  }, []);

  const handleRedial = (mode: "voice" | "video") => {
    if (mode === "video") {
      openVideoCall();
      return;
    }

    openVoiceCall();
  };

  const handleCreateGroup = () => {
    setIsCreateGroupOpen(true);
  };

  const handleGroupCreated = async (roomId: string) => {
    await reloadRooms();
    setActiveRoomId(roomId);
  };

  const handleLeaveGroup = async () => {
    if (!activeRoom || activeRoom.roomType !== "GROUP") return;

    await leaveGroup(activeRoom.id);
    await reloadRooms();
    setActiveRoomId("");
  };

  const handleDissolveGroup = async () => {
    if (!activeRoom || activeRoom.roomType !== "GROUP") return;

    await dissolveGroup(activeRoom.id);
    await reloadRooms();
    setActiveRoomId("");
  };

  const handleGroupDetailsChange = useCallback(
    (nextDetails: GroupRoomDetails) => {
      setGroupDetailsByRoom((prev) => ({
        ...prev,
        [nextDetails.roomId]: nextDetails,
      }));

      setRooms((prev) =>
        prev.map((room) => {
          if (room.id !== nextDetails.roomId) {
            return room;
          }

          return {
            ...room,
            title: nextDetails.title,
            peerUserId: nextDetails.roomId,
            peerName: nextDetails.title,
            avatarUrl: nextDetails.avatarUrl,
            description: nextDetails.description,
            emoji: nextDetails.emoji,
            memberCount: nextDetails.memberCount,
            memberRole: nextDetails.currentUserRole,
            preview: nextDetails.lastMessagePreview ?? room.preview,
            lastMessageAt: nextDetails.lastMessageAt ?? room.lastMessageAt,
            age: nextDetails.lastMessageAt
              ? toAgeLabel(nextDetails.lastMessageAt)
              : room.age,
          };
        }),
      );
    },
    [setGroupDetailsByRoom, setRooms],
  );

  const handleGroupMembersAdded = useCallback(async () => {
    if (!activeRoom || activeRoom.roomType !== "GROUP") {
      await reloadRooms();
      return;
    }

    const latest = await fetchGroupRoomDetails(activeRoom.id);
    handleGroupDetailsChange(latest);
    await reloadRooms();
  }, [activeRoom, handleGroupDetailsChange, reloadRooms]);

  const handleDeleteChatHistory = useCallback(async () => {
    if (!activeRoom) {
      return;
    }

    const clearedAt = new Date().toISOString();

    setClearedRoomAtById((prev) => ({
      ...prev,
      [activeRoom.id]: clearedAt,
    }));

    setMessagesByRoom((prev) => ({
      ...prev,
      [activeRoom.id]: [],
    }));

    setRooms((prev) =>
      prev.map((room) =>
        room.id === activeRoom.id
          ? {
              ...room,
              preview: "Đã xóa lịch sử",
              unreadCount: 0,
              age: "Now",
            }
          : room,
      ),
    );

    setReplyTo(undefined);
    setTypingText("");
  }, [activeRoom]);

  const handleAcceptGroupCall = () => {
    if (!pendingGroupCall) return;

    setGroupCallRoomId(pendingGroupCall.roomId);
    setGroupCallMode(pendingGroupCall.callMode);
    setGroupCallDirection("incoming");
    setPendingGroupCall(null);
  };

  const handleDeclineGroupCall = () => {
    setPendingGroupCall(null);
  };

  return (
    <section className="h-full w-full overflow-hidden bg-[#f8f9fb]">
      <div className="flex h-full">
        <ChatSidebar
          rooms={sidebarRooms}
          activeRoomId={effectiveActiveRoomId}
          onSelectRoom={handleSelectRoom}
          onCreateGroup={handleCreateGroup}
        />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-[#f8f9fb] lg:min-h-0">
          {!isLoadingRooms && (!hasRooms || !effectiveActiveRoomId) ? (
            <ChatNoRoomWelcome />
          ) : (
            <>
              <ChatHeader
                peerName={peerName}
                orderTitle={orderTitle}
                typingText={typingText}
                isPeerOnline={isPeerOnline}
                onOpenVoiceCall={handleOpenVoiceCall}
                onOpenVideoCall={handleOpenVideoCall}
              />

              <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3 lg:px-6 lg:pb-4 lg:pt-4">
                <MessageList
                  messages={activeMessages}
                  currentUserId={currentUserId}
                  currentUserName={currentUserName}
                  peerName={peerName}
                  canReply={activeRoom?.roomType !== "GROUP"}
                  listRef={listRef}
                  onReply={setReplyTo}
                  onRecall={handleRecall}
                  onRedial={handleRedial}
                  className="flex-1"
                />
                <div className="mt-2 lg:mt-3">
                  <MessageInput
                    replyTo={replyTo}
                    onClearReply={() => setReplyTo(undefined)}
                    onSend={handleSend}
                    onTyping={handleTyping}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <ChatInfoPanel
          room={activeRoom}
          groupDetails={activeGroupDetails}
          currentUserId={currentUserId}
          onLeaveGroup={handleLeaveGroup}
          onDissolveGroup={handleDissolveGroup}
          onOpenCreateGroup={handleCreateGroup}
          onDeleteChatHistory={handleDeleteChatHistory}
          onGroupDetailsChange={handleGroupDetailsChange}
          onMembersAdded={() => {
            void handleGroupMembersAdded();
          }}
        />
      </div>

      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onCreated={(roomId) => {
          void handleGroupCreated(roomId);
        }}
      />

      <IncomingCallModal
        isOpen={incomingCall !== null}
        senderName={incomingCall?.senderName ?? ""}
        callMode={incomingCall?.callMode ?? "voice"}
        isOnline={incomingCall?.isOnline ?? false}
        onAccept={handleAcceptIncomingCall}
        onDecline={handleDeclineIncomingCall}
      />

      <IncomingGroupCallModal
        isOpen={pendingGroupCall !== null}
        roomTitle={
          pendingGroupCall
            ? (groupDetailsByRoom[pendingGroupCall.roomId]?.title ??
              activeRoom?.title ??
              "Nhóm")
            : "Nhóm"
        }
        callerName={
          pendingGroupCall
            ? (groupDetailsByRoom[pendingGroupCall.roomId]?.members.find(
                (member) => member.userId === pendingGroupCall.senderId,
              )?.name ?? "Thành viên")
            : "Thành viên"
        }
        callMode={pendingGroupCall?.callMode ?? "voice"}
        participantCount={
          pendingGroupCall
            ? (groupDetailsByRoom[pendingGroupCall.roomId]?.memberCount ?? 0)
            : 0
        }
        onAccept={handleAcceptGroupCall}
        onDecline={handleDeclineGroupCall}
      />

      {groupCallRoomId && groupCallMode && activeGroupCallDetails ? (
        <GroupCallComponent
          socket={socketRef.current}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          roomId={groupCallRoomId}
          groupDetails={activeGroupCallDetails}
          callMode={groupCallMode}
          callDirection={groupCallDirection ?? "incoming"}
          onClose={() => {
            setGroupCallRoomId("");
            setGroupCallMode(null);
            setGroupCallDirection(null);
          }}
        />
      ) : (
        <VideoCallComponent
          socket={socketRef.current}
          currentUserId={currentUserId}
          peerUserId={peerUserId}
          peerName={peerName}
          orderTitle={orderTitle}
          callMode={callMode}
          callDirection={callDirection}
          onModeChange={setCallMode}
          onClose={handleCloseCall}
        />
      )}
    </section>
  );
}
