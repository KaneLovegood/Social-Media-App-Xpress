"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import {
  leaveGroup,
  dissolveGroup,
  fetchGroupRoomDetails,
  type GroupRoomDetails,
} from "@/lib/chat-groups";
import {
  clearSession,
  getStoredUser,
  getValidAccessToken,
  logoutSession,
  USER_UPDATED_EVENT,
} from "@/lib/auth-client";
import { sendChatAction } from "@/lib/chat-actions";
import { fetchChatRoomMessages } from "@/lib/chat-messages";
import { ChatRoomSummary, fetchChatRooms } from "@/lib/chat-rooms";
import { CHAT_EVENTS, CALL_EVENTS } from "@/lib/realtime/events";
import { createChatSocket } from "@/lib/realtime/socket-client";
import { ChatMessage, ReplyPreview } from "@/lib/realtime/types";
import { toAgeLabel, mergeMessages } from "@/lib/chat-utils";
import IncomingCallModal from "./modal/IncomingCallModal";
import IncomingGroupCallModal from "./modal/IncomingGroupCallModal";
import ChatInfoPanel from "./ChatInfoPanel";
import CreateGroupModal from "./modal/CreateGroupModal";
import ForwardMessageModal from "./modal/ForwardMessageModal";
import VideoCallComponent from "../video/VideoCallComponent";
import GroupCallComponent from "../video/GroupCallComponent";
import ChatContent from "./ChatContent";
import { SendMessageOptions } from "./MessageInput";
import ChatNoRoomWelcome from "./ChatNoRoomWelcome";
import ChatSidebar, { SidebarChatItem } from "./ChatSidebar";
import ChatAppRail from "./ChatAppRail";
import AiChatBox from "./AiChatBox";
import { useClearedHistory } from "@/hooks/useClearedHistory";
import { useCallState } from "@/hooks/useCallState";
import { useMessageActions } from "@/hooks/useMessageActions";
import { useChatSocketHandlers } from "@/hooks/useChatSocketHandlers";

interface ChatContainerProps {
  currentUserId: string;
  currentUserName: string;
  initialRoomId?: string;
  initialPeerUserId?: string;
  onRoomResolved?: () => void;
}

function toInitials(name?: string): string {
  if (!name) return "";

  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export default function ChatContainer({
  currentUserId,
  currentUserName,
  initialRoomId,
  initialPeerUserId,
  onRoomResolved,
}: ChatContainerProps) {
  const router = useRouter();
  // Manage cleared history
  const { clearedRoomAtById, setClearedRoomAtById } =
    useClearedHistory(currentUserId);

  // Manage call states
  const {
    callMode,
    setCallMode,
    callDirection,
    setCallDirection,
    incomingCall,
    setIncomingCall,
    groupCallRoomId,
    setGroupCallRoomId,
    groupCallMode,
    setGroupCallMode,
    groupCallDirection,
    setGroupCallDirection,
    groupCallHostUserId,
    setGroupCallHostUserId,
    pendingGroupCall,
    setPendingGroupCall,
    rejoinableGroupCall,
    setRejoinableGroupCall,
  } = useCallState();

  // Room management state
  const [rooms, setRooms] = useState<ChatRoomSummary[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [activeRoomId, setActiveRoomId] = useState("");
  const [messagesByRoom, setMessagesByRoom] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [loadedRoomIds, setLoadedRoomIds] = useState<Record<string, boolean>>(
    {},
  );
  const [groupDetailsByRoom, setGroupDetailsByRoom] = useState<
    Record<string, GroupRoomDetails>
  >({});
  const [presenceByUser, setPresenceByUser] = useState<Record<string, boolean>>(
    {},
  );
  const [replyTo, setReplyTo] = useState<ReplyPreview | undefined>(undefined);
  const [typingText, setTypingText] = useState("");
  const [typingSenderId, setTypingSenderId] = useState<string | undefined>(
    undefined,
  );
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [forwardingMessage, setForwardingMessage] =
    useState<ChatMessage | null>(null);
  const [isMobileInfoOpen, setIsMobileInfoOpen] = useState(false);
  const [isMobileRailOpen, setIsMobileRailOpen] = useState(false);
  const [currentUserAvatarUrl, setCurrentUserAvatarUrl] = useState(
    () => getStoredUser()?.avatarUrl?.trim() ?? "",
  );
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncUserAvatar = () => {
      setCurrentUserAvatarUrl(getStoredUser()?.avatarUrl?.trim() ?? "");
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== "xpress_user") {
        return;
      }

      syncUserAvatar();
    };

    window.addEventListener(USER_UPDATED_EVENT, syncUserAvatar);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(USER_UPDATED_EVENT, syncUserAvatar);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Load rooms
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

  // Initialize socket
  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    void getValidAccessToken().then((token) => {
      if (!token || cancelled) return;
      socket = createChatSocket(token);
      socketRef.current = socket;
    });

    return () => {
      cancelled = true;
      socket?.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [currentUserId]);

  // Load initial rooms
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
    () =>
      rooms.some((room) => room.id === activeRoomId) ||
      activeRoomId === "AI_ASSISTANT"
        ? activeRoomId
        : "",
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
  const activeRejoinableGroupCall =
    activeRoom?.roomType === "GROUP" &&
    rejoinableGroupCall?.roomId === activeRoom.id
      ? rejoinableGroupCall
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
  const senderNameById = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {
      [currentUserId]: currentUserName,
    };

    if (activeRoom?.roomType === "GROUP") {
      for (const member of activeGroupDetails?.members ?? []) {
        map[member.userId] = member.nickname ?? member.name;
      }
      return map;
    }

    if (peerUserId) {
      map[peerUserId] = peerName;
    }

    return map;
  }, [
    activeGroupDetails?.members,
    activeRoom?.roomType,
    currentUserId,
    currentUserName,
    peerName,
    peerUserId,
  ]);
  const senderAvatarById = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};

    if (currentUserAvatarUrl) {
      map[currentUserId] = currentUserAvatarUrl;
    }

    if (activeRoom?.roomType === "GROUP") {
      for (const member of activeGroupDetails?.members ?? []) {
        if (member.avatarUrl) {
          map[member.userId] = member.avatarUrl;
        }
      }
      return map;
    }

    if (peerUserId && activeRoom?.avatarUrl) {
      map[peerUserId] = activeRoom.avatarUrl;
    }

    return map;
  }, [
    activeGroupDetails?.members,
    activeRoom?.avatarUrl,
    activeRoom?.roomType,
    currentUserAvatarUrl,
    currentUserId,
    peerUserId,
  ]);
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
  const hasInitialSelection = Boolean(initialRoomId || initialPeerUserId);
  const hasInitialSelectionMatch = useMemo(() => {
    if (!hasInitialSelection) return false;

    if (initialRoomId && rooms.some((room) => room.id === initialRoomId)) {
      return true;
    }

    if (
      initialPeerUserId &&
      rooms.some((room) => room.peerUserId === initialPeerUserId)
    ) {
      return true;
    }

    return false;
  }, [hasInitialSelection, initialPeerUserId, initialRoomId, rooms]);

  const isResolvingInitialSelection =
    hasInitialSelection &&
    !effectiveActiveRoomId &&
    (isLoadingRooms || hasInitialSelectionMatch);

  const shouldShowNoRoomWelcome =
    !isResolvingInitialSelection && !effectiveActiveRoomId;

  useEffect(() => {
    if (hasInitialSelection && effectiveActiveRoomId && onRoomResolved) {
      onRoomResolved();
    }
  }, [effectiveActiveRoomId, hasInitialSelection, onRoomResolved]);

  const roomByPeer = useMemo(
    () => new Map(rooms.map((room) => [room.peerUserId, room.id])),
    [rooms],
  );

  const sidebarRooms = useMemo<SidebarChatItem[]>(() => {
    const dbRooms = rooms.map((room) => {
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
    });

    return [
      {
        id: "AI_ASSISTANT",
        roomType: "PRIVATE",
        title: "Logistics AI Assistant",
        preview: "Trợ lý ảo phân tích Logistics",
        age: "",
        unreadCount: 0,
        isOnline: true,
      },
      ...dbRooms,
    ];
  }, [clearedRoomAtById, presenceByUser, rooms]);

  const handleSelectRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    setReplyTo(undefined);
    setTypingText("");
    setIsMobileInfoOpen(false);
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
    if (activeRoomId === "AI_ASSISTANT") return;

    if (activeRoomId && rooms.some((room) => room.id === activeRoomId)) {
      return;
    }

    if (initialRoomId === "AI_ASSISTANT") {
      setActiveRoomId("AI_ASSISTANT");
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
  }, [effectiveActiveRoomId, activeRoom?.roomType]);

  // Setup socket event handlers
  useChatSocketHandlers({
    socket: socketRef.current,
    currentUserId,
    effectiveActiveRoomId,
    activeRoomRoomType: activeRoom?.roomType ?? null,
    peerUserId,
    roomByPeer,
    reloadRooms,
    ensureGroupDetails,
    setMessages: setMessagesByRoom,
    setRooms,
    setGroupDetails: setGroupDetailsByRoom,
    setPresenceByUser,
    setTypingText,
    setTypingSenderId,
    setIncomingCall,
    groupCallRoomId,
    groupCallMode,
    pendingGroupCall,
    rejoinableGroupCall,
    setGroupCallRoomId,
    setGroupCallMode,
    setGroupCallDirection,
    setGroupCallHostUserId,
    setPendingGroupCall,
    setRejoinableGroupCall,
    setCallMode,
    setCallDirection,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  useEffect(() => {
    const listElement = listRef.current;
    if (!listElement) return;
    listElement.scrollTo({
      top: listElement.scrollHeight,
      behavior: "smooth",
    });
  }, [activeMessages]);

  // Ensure typing indicator is visible (scroll to bottom) when someone else is typing
  useEffect(() => {
    const listElement = listRef.current;
    if (!listElement) return;
    if (!typingText) return;
    // Only auto-scroll for typing events from others
    if (typingSenderId && typingSenderId === currentUserId) return;

    listElement.scrollTo({
      top: listElement.scrollHeight,
      behavior: "smooth",
    });
  }, [typingText, typingSenderId, currentUserId]);

  const handleSend = (content: string, options?: SendMessageOptions) => {
    if (!socketRef.current || !effectiveActiveRoomId) return;

    const payload = {
      content,
      ...options,
    };

    if (activeRoom?.roomType === "GROUP") {
      socketRef.current.emit(CHAT_EVENTS.GROUP_SEND, {
        roomId: effectiveActiveRoomId,
        ...payload,
      });
      return;
    }

    if (!peerUserId) return;

    if (replyTo) {
      socketRef.current.emit(CHAT_EVENTS.REPLY, {
        receiverId: peerUserId,
        replyToMessageId: replyTo.messageId,
        ...payload,
      });
      setReplyTo(undefined);
      return;
    }

    socketRef.current.emit(CHAT_EVENTS.SEND, {
      receiverId: peerUserId,
      ...payload,
    });
  };

  const handleRecall = (messageId: string) => {
    socketRef.current?.emit(CHAT_EVENTS.RECALL, { messageId });
  };

  const handleOpenForwardMessage = (message: ChatMessage) => {
    setForwardingMessage(message);
  };

  const handleForwardMessage = (roomIds: string[]) => {
    if (!forwardingMessage || roomIds.length === 0) return;

    const payload = {
      content: forwardingMessage.content,
      messageType: forwardingMessage.messageType,
      fileUrl: forwardingMessage.fileUrl,
      fileName: forwardingMessage.fileName,
      fileSize: forwardingMessage.fileSize,
      mimeType: forwardingMessage.mimeType,
    };

    roomIds.forEach((roomId) => {
      const targetRoom = rooms.find((room) => room.id === roomId);
      if (!targetRoom) return;

      if (targetRoom.roomType === "GROUP") {
        socketRef.current?.emit(CHAT_EVENTS.GROUP_SEND, {
          roomId: targetRoom.id,
          ...payload,
        });
        return;
      }

      if (!targetRoom.peerUserId) return;

      socketRef.current?.emit(CHAT_EVENTS.SEND, {
        receiverId: targetRoom.peerUserId,
        ...payload,
      });
    });

    setForwardingMessage(null);
  };

  // Message actions
  const {
    handleCopyMessage,
    handlePinMessage,
    handleMarkMessage,
    handleSelectManyMessage,
    handleViewMessageDetails,
    emitMessageActionEvent,
  } = useMessageActions(effectiveActiveRoomId, peerUserId);

  const handleDeleteForMe = useCallback(
    (messageId: string) => {
      if (!effectiveActiveRoomId) return;

      setMessagesByRoom((prev) => ({
        ...prev,
        [effectiveActiveRoomId]: (prev[effectiveActiveRoomId] ?? []).filter(
          (message) => message.messageId !== messageId,
        ),
      }));

      setReplyTo((prev) => (prev?.messageId === messageId ? undefined : prev));
    },
    [effectiveActiveRoomId],
  );

  const handleDeleteForMeWithEvent = useCallback(
    (messageId: string) => {
      handleDeleteForMe(messageId);
      emitMessageActionEvent("delete_message_for_me", { messageId });
    },
    [emitMessageActionEvent, handleDeleteForMe],
  );

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
    async (mode: "voice" | "video", hostUserId = currentUserId) => {
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
      setRejoinableGroupCall(null);
      setGroupCallHostUserId(hostUserId);

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
      currentUserId,
      setGroupCallHostUserId,
      setRejoinableGroupCall,
    ],
  );

  const resumeGroupCall = useCallback(() => {
    if (!activeRejoinableGroupCall) return;

    // Defensive: clear any pending incoming modal and clear rejoinable flag
    setPendingGroupCall(null);
    setRejoinableGroupCall(null);

    void startGroupCall(
      activeRejoinableGroupCall.callMode,
      activeRejoinableGroupCall.callHostUserId,
    );
  }, [activeRejoinableGroupCall, startGroupCall]);

  const handleOpenVoiceCall = () => {
    if (activeRoom?.roomType === "GROUP") {
      if (activeRejoinableGroupCall) {
        resumeGroupCall();
        return;
      }
      void startGroupCall("voice");
      return;
    }

    openVoiceCall();
  };

  const handleOpenVideoCall = () => {
    if (activeRoom?.roomType === "GROUP") {
      if (activeRejoinableGroupCall) {
        resumeGroupCall();
        return;
      }
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

  const handleLogout = useCallback(async () => {
    try {
      await logoutSession();
    } catch (error) {
      await clearSession();
      const message =
        error instanceof Error
          ? error.message
          : "Đăng xuất thất bại, vui lòng thử lại.";
      if (typeof window !== "undefined") {
        window.alert(message);
      }
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }, [router]);

  const handleGroupCreated = async (roomId: string) => {
    await reloadRooms();
    setActiveRoomId(roomId);
  };

  const handleLeaveGroup = async () => {
    if (!activeRoom || activeRoom.roomType !== "GROUP") return;
    try {
      await leaveGroup(activeRoom.id);
    } catch (error) {
      // Nếu server trả lỗi (ví dụ 500 khi backend xử lý dissolve), không để app crash.
      // Log và báo cho người dùng, nhưng vẫn refresh UI để phản ánh trạng thái hiện tại.
      // eslint-disable-next-line no-console
      console.error("leaveGroup error:", error);
      if (typeof window !== "undefined") {
        const msg = error instanceof Error ? error.message : "Không thể rời nhóm";
        try {
          window.alert(msg);
        } catch {}
      }
    } finally {
      await reloadRooms();
      setActiveRoomId("");
    }
  };

  // Dùng cho admin: API leave đã được gọi bên trong transferGroupAdmin
  // Handler này chỉ cần refresh UI
  const handleAdminLeaveGroup = async () => {
    await reloadRooms();
    setActiveRoomId("");
  };

  const handleDissolveGroup = async () => {
    if (!activeRoom || activeRoom.roomType !== "GROUP") return;
    try {
      await dissolveGroup(activeRoom.id);
    } catch (error) {
      // Log và hiển thị lỗi, nhưng đảm bảo UI refresh
      // eslint-disable-next-line no-console
      console.error("dissolveGroup error:", error);
      if (typeof window !== "undefined") {
        const msg = error instanceof Error ? error.message : "Không thể giải tán nhóm";
        try {
          window.alert(msg);
        } catch {}
      }
    } finally {
      await reloadRooms();
      setActiveRoomId("");
    }
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
    setTypingSenderId("");
  }, [activeRoom]);

  const handleAcceptGroupCall = () => {
    if (!pendingGroupCall) return;

    setGroupCallRoomId(pendingGroupCall.roomId);
    setGroupCallMode(pendingGroupCall.callMode);
    setGroupCallDirection("incoming");
    setGroupCallHostUserId(pendingGroupCall.senderId);
    setRejoinableGroupCall(null);
    setPendingGroupCall(null);
  };

  const handleDeclineGroupCall = () => {
    setPendingGroupCall(null);
  };

  return (
    <section className="h-full w-full overflow-hidden bg-[#f8f9fb]">
      <div className="flex h-full">
        <div
          className={
            effectiveActiveRoomId ? "hidden md:flex" : "flex w-full md:w-auto"
          }
        >
          <ChatSidebar
            rooms={sidebarRooms}
            activeRoomId={effectiveActiveRoomId}
            currentUserName={currentUserName}
            onSelectRoom={handleSelectRoom}
            onCreateGroup={handleCreateGroup}
            onOpenRail={() => setIsMobileRailOpen(true)}
            onLogout={handleLogout}
          />
        </div>

        {isMobileRailOpen ? (
          <>
            <button
              type="button"
              aria-label="Đóng thanh điều hướng"
              className="fixed inset-0 z-40 bg-slate-900/35 md:hidden"
              onClick={() => setIsMobileRailOpen(false)}
            />
            <ChatAppRail
              activeNav="chat"
              initials={toInitials(currentUserName) || undefined}
              onLogout={handleLogout}
              mobileOpen
              onRequestClose={() => setIsMobileRailOpen(false)}
            />
          </>
        ) : null}

        <div
          className={`min-h-0 min-w-0 flex-1 flex-col bg-[#f8f9fb] ${
            effectiveActiveRoomId ? "flex" : "hidden md:flex"
          }`}
        >
          {shouldShowNoRoomWelcome ? (
            <ChatNoRoomWelcome />
          ) : effectiveActiveRoomId === "AI_ASSISTANT" ? (
            <AiChatBox
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              onBackToList={() => {
                setIsMobileInfoOpen(false);
                setActiveRoomId("");
              }}
            />
          ) : (
              <ChatContent
              peerName={peerName}
              orderTitle={orderTitle}
              typingText={typingText}
              typingSenderId={
                activeRoom?.roomType === "GROUP" ? typingSenderId : peerUserId
              }
              isPeerOnline={isPeerOnline}
              isGroup={activeRoom?.roomType === "GROUP"}
              activeMessages={activeMessages}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              senderNameById={senderNameById}
              senderAvatarById={senderAvatarById}
              listRef={listRef}
              replyTo={replyTo}
              onBackToList={() => {
                setIsMobileInfoOpen(false);
                setActiveRoomId("");
              }}
              onOpenInfo={() => setIsMobileInfoOpen(true)}
              onOpenVoiceCall={handleOpenVoiceCall}
              onOpenVideoCall={handleOpenVideoCall}
              rejoinableGroupCall={activeRejoinableGroupCall}
              onResumeGroupCall={resumeGroupCall}
              onClearReply={() => setReplyTo(undefined)}
              onSend={handleSend}
              onTyping={handleTyping}
              onReply={setReplyTo}
              onForward={handleOpenForwardMessage}
              onRecall={handleRecall}
              onDeleteForMe={handleDeleteForMeWithEvent}
              onCopy={handleCopyMessage}
              onPin={handlePinMessage}
              onMark={handleMarkMessage}
              onSelectMany={handleSelectManyMessage}
              onViewDetails={handleViewMessageDetails}
              onRedial={handleRedial}
            />
          )}
        </div>

        {effectiveActiveRoomId && effectiveActiveRoomId !== "AI_ASSISTANT" ? (
          <ChatInfoPanel
            room={activeRoom}
            groupDetails={activeGroupDetails}
            currentUserId={currentUserId}
            onLeaveGroup={() => { void handleLeaveGroup(); }}
            onAdminLeaveGroup={() => { void handleAdminLeaveGroup(); }}
            onDissolveGroup={() => { void handleDissolveGroup(); }}
            onOpenCreateGroup={handleCreateGroup}
            onDeleteChatHistory={handleDeleteChatHistory}
            onGroupDetailsChange={handleGroupDetailsChange}
            onMembersAdded={() => {
              void handleGroupMembersAdded();
            }}
          />
        ) : null}

        {effectiveActiveRoomId &&
        effectiveActiveRoomId !== "AI_ASSISTANT" &&
        isMobileInfoOpen ? (
          <>
            <button
              type="button"
              aria-label="Đóng thông tin hội thoại"
              className="fixed inset-0 z-40 bg-slate-900/35 lg:hidden"
              onClick={() => setIsMobileInfoOpen(false)}
            />
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
              isMobileOpen
              onCloseMobile={() => setIsMobileInfoOpen(false)}
            />
          </>
        ) : null}
      </div>

      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onCreated={(roomId) => {
          void handleGroupCreated(roomId);
        }}
      />

      <ForwardMessageModal
        key={forwardingMessage?.messageId ?? "closed"}
        isOpen={forwardingMessage !== null}
        message={forwardingMessage}
        rooms={rooms}
        currentRoomId={effectiveActiveRoomId}
        onClose={() => setForwardingMessage(null)}
        onForward={handleForwardMessage}
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
        isOpen={
          pendingGroupCall !== null &&
          !(rejoinableGroupCall && rejoinableGroupCall.roomId === pendingGroupCall?.roomId)
        }
        suppress={!!(rejoinableGroupCall && rejoinableGroupCall.roomId === pendingGroupCall?.roomId)}
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
          callHostUserId={groupCallHostUserId}
          onLeave={() => {
            setRejoinableGroupCall({
              roomId: groupCallRoomId,
              callMode: groupCallMode,
              callHostUserId: groupCallHostUserId,
            });
            // clear any pending incoming invite for this room to avoid modal
            setPendingGroupCall(null);
            setGroupCallRoomId("");
            setGroupCallMode(null);
            setGroupCallDirection(null);
            setGroupCallHostUserId("");
          }}
          onClose={() => {
            setRejoinableGroupCall(null);
            setGroupCallRoomId("");
            setGroupCallMode(null);
            setGroupCallDirection(null);
            setGroupCallHostUserId("");
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
