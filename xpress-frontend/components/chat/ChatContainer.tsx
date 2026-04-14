"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { getAccessToken } from "@/lib/auth-client";
import {
  addGroupMember,
  createGroup,
  fetchGroupMessages,
  fetchGroupDetail,
  fetchGroups,
  GroupDetail,
  GroupSummary,
  disbandGroup,
  leaveGroup,
  updateGroupCallState,
} from "@/lib/groups";
import { sendChatAction } from "@/lib/chat-actions";
import { ChatRoomSummary, fetchChatRooms } from "@/lib/chat-rooms";
import { CALL_EVENTS, CHAT_EVENTS, GROUP_EVENTS } from "@/lib/realtime/events";
import { createChatSocket } from "@/lib/realtime/socket-client";
import {
  ChatMessage,
  MessageStateUpdate,
  ReplyPreview,
  TypingPayload,
} from "@/lib/realtime/types";
import { SocialUser, fetchAllFriends } from "@/lib/social";
import IncomingCallModal from "./IncomingCallModal";
import ConversationInfoPanel from "@/components/chat/ConversationInfoPanel";
import CreateGroupModal from "@/components/chat/CreateGroupModal";
import VideoCallComponent from "../video/VideoCallComponent";
import ChatHeader from "./ChatHeader";
import ChatNoRoomWelcome from "./ChatNoRoomWelcome";
import ChatSidebar, { SidebarChatItem } from "./ChatSidebar";
import MessageInput from "./MessageInput";
import MessageList from "./MessageList";

type CallMode = "voice" | "video" | null;
type CallDirection = "incoming" | "outgoing" | null;

interface ChatContainerProps {
  currentUserId: string;
  initialRoomId?: string;
  initialPeerUserId?: string;
}

export default function ChatContainer({
  currentUserId,
  initialRoomId,
  initialPeerUserId,
}: ChatContainerProps) {
  const [rooms, setRooms] = useState<ChatRoomSummary[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [activeRoomId, setActiveRoomId] = useState("");
  const [activeGroupId, setActiveGroupId] = useState("");
  const [selectedGroupDetail, setSelectedGroupDetail] =
    useState<GroupDetail | null>(null);
  const [groupMessagesByGroup, setGroupMessagesByGroup] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [messagesByRoom, setMessagesByRoom] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [replyTo, setReplyTo] = useState<ReplyPreview | undefined>(undefined);
  const [typingText, setTypingText] = useState("");
  const [callMode, setCallMode] = useState<CallMode>(null);
  const [callDirection, setCallDirection] = useState<CallDirection>(null);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(
    null,
  );
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [groupFriends, setGroupFriends] = useState<SocialUser[]>([]);
  const [isLoadingGroupFriends, setIsLoadingGroupFriends] = useState(false);
  const [panelNotice, setPanelNotice] = useState("");
  const [presenceByUser, setPresenceByUser] = useState<
    Record<string, { isOnline: boolean; lastSeenAt: string | null }>
  >({});
  const [incomingCall, setIncomingCall] = useState<{
    senderId: string;
    senderName: string;
    callMode: "voice" | "video";
    sessionId: string;
    isOnline: boolean;
  } | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const token = useMemo(() => getAccessToken(), []);

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

    void fetchChatRooms()
      .then((fetchedRooms) => {
        if (!mounted) return;
        setRooms(fetchedRooms);
        setIsLoadingRooms(false);
      })
      .catch(() => {
        if (!mounted) return;
        setRooms([]);
        setIsLoadingRooms(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    void fetchGroups()
      .then((fetchedGroups) => {
        if (!mounted) return;
        setGroups(fetchedGroups);
        setIsLoadingGroups(false);
      })
      .catch(() => {
        if (!mounted) return;
        setGroups([]);
        setIsLoadingGroups(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const effectiveActiveRoomId = useMemo(
    () => (rooms.some((room) => room.id === activeRoomId) ? activeRoomId : ""),
    [activeRoomId, rooms],
  );

  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === effectiveActiveRoomId) ?? null,
    [effectiveActiveRoomId, rooms],
  );
  const peerUserId = activeRoom?.peerUserId ?? "";
  const peerName = activeRoom?.peerName ?? "User";
  const orderTitle = activeRoom?.title ?? "No active room";
  const hasRooms = rooms.length > 0;
  const peerPresence = presenceByUser[peerUserId] ?? {
    isOnline: false,
    lastSeenAt: null,
  };
  const activeMessages = useMemo(
    () =>
      effectiveActiveRoomId
        ? (messagesByRoom[effectiveActiveRoomId] ?? [])
        : [],
    [effectiveActiveRoomId, messagesByRoom],
  );

  const activeGroupMessages = useMemo(
    () => (activeGroupId ? (groupMessagesByGroup[activeGroupId] ?? []) : []),
    [activeGroupId, groupMessagesByGroup],
  );
  const selectedGroupSummary = useMemo(
    () => groups.find((group) => group.groupId === activeGroupId) ?? null,
    [activeGroupId, groups],
  );

  const roomByPeer = useMemo(
    () => new Map(rooms.map((room) => [room.peerUserId, room.id])),
    [rooms],
  );

  const sidebarRooms = useMemo<SidebarChatItem[]>(
    () =>
      rooms.map((room) => ({
        id: room.id,
        title: room.title,
        preview: room.preview,
        age: room.age,
      })),
    [rooms],
  );

  const handleSelectRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    setActiveGroupId("");
    setSelectedGroupDetail(null);
    setReplyTo(undefined);
    setTypingText("");
    setSelectedMessage(null);
    setPanelNotice("");
  };

  const openCreateGroupModal = () => {
    setIsCreateGroupModalOpen(true);
    setPanelNotice("");
  };

  const reloadGroups = useCallback(async () => {
    const fetchedGroups = await fetchGroups();
    setGroups(fetchedGroups);
  }, []);

  const handleSelectGroup = useCallback(async (groupId: string) => {
    setActiveGroupId(groupId);
    setActiveRoomId("");
    setSelectedMessage(null);
    setPanelNotice("");
    setReplyTo(undefined);
    setTypingText("");
    socketRef.current?.emit(GROUP_EVENTS.JOIN, { groupId });

    try {
      const [detail, messages] = await Promise.all([
        fetchGroupDetail(groupId),
        fetchGroupMessages(groupId),
      ]);
      setSelectedGroupDetail(detail);
      setGroupMessagesByGroup((prev) => ({
        ...prev,
        [groupId]: messages,
      }));
    } catch {
      setSelectedGroupDetail(null);
    }
  }, []);

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
    const socket = socketRef.current;
    if (!socket) return;

    const onMessage = (message: ChatMessage) => {
      const counterpartUserId =
        message.senderId === currentUserId
          ? message.receiverId
          : message.senderId;
      let roomId = roomByPeer.get(counterpartUserId);

      // Fallback: if room not yet loaded, compute room ID from conversation
      if (!roomId) {
        const [first, second] = [currentUserId, counterpartUserId].sort();
        roomId = `${first}:${second}`;
      }

      setMessagesByRoom((prev) => {
        const roomMessages = prev[roomId] ?? [];
        const exists = roomMessages.some(
          (item) => item.messageId === message.messageId,
        );
        if (exists) return prev;

        return {
          ...prev,
          [roomId]: [...roomMessages, message],
        };
      });
    };

    const onDeleted = (payload: MessageStateUpdate) => {
      const counterpartUserId =
        payload.senderId === currentUserId
          ? payload.receiverId
          : payload.senderId;
      let roomId = roomByPeer.get(counterpartUserId);

      if (!roomId) {
        const [first, second] = [currentUserId, counterpartUserId].sort();
        roomId = `${first}:${second}`;
      }

      setMessagesByRoom((prev) => ({
        ...prev,
        [roomId]: (prev[roomId] ?? []).map((message) =>
          message.messageId === payload.messageId
            ? { ...message, isDeleted: true, updatedAt: payload.updatedAt }
            : message,
        ),
      }));
    };

    const onRecalled = (payload: MessageStateUpdate) => {
      const counterpartUserId =
        payload.senderId === currentUserId
          ? payload.receiverId
          : payload.senderId;
      let roomId = roomByPeer.get(counterpartUserId);

      if (!roomId) {
        const [first, second] = [currentUserId, counterpartUserId].sort();
        roomId = `${first}:${second}`;
      }

      setMessagesByRoom((prev) => ({
        ...prev,
        [roomId]: (prev[roomId] ?? []).map((message) =>
          message.messageId === payload.messageId
            ? { ...message, isRecalled: true, updatedAt: payload.updatedAt }
            : message,
        ),
      }));
    };

    const onTyping = (payload: TypingPayload) => {
      if (
        payload.senderId !== peerUserId ||
        payload.receiverId !== currentUserId
      )
        return;
      setTypingText(payload.isTyping ? "Typing..." : "");

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = window.setTimeout(() => {
        setTypingText("");
      }, 1500);
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

    const onGroupMessage = (message: ChatMessage) => {
      const groupId = message.conversationId;
      if (!groupId) return;

      setGroupMessagesByGroup((prev) => {
        const current = prev[groupId] ?? [];
        if (current.some((item) => item.messageId === message.messageId)) {
          return prev;
        }

        return {
          ...prev,
          [groupId]: [...current, message],
        };
      });
    };

    const onGroupDeleted = (
      payload: MessageStateUpdate & { groupId?: string },
    ) => {
      const groupId = payload.groupId;
      if (!groupId) return;

      setGroupMessagesByGroup((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] ?? []).map((message) =>
          message.messageId === payload.messageId
            ? { ...message, isDeleted: true, updatedAt: payload.updatedAt }
            : message,
        ),
      }));
    };

    const onGroupRecalled = (
      payload: MessageStateUpdate & { groupId?: string },
    ) => {
      const groupId = payload.groupId;
      if (!groupId) return;

      setGroupMessagesByGroup((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] ?? []).map((message) =>
          message.messageId === payload.messageId
            ? { ...message, isRecalled: true, updatedAt: payload.updatedAt }
            : message,
        ),
      }));
    };

    const onGroupTyping = (payload: {
      senderId: string;
      groupId: string;
      isTyping: boolean;
    }) => {
      if (
        payload.groupId !== activeGroupId ||
        payload.senderId === currentUserId
      ) {
        return;
      }

      setTypingText(payload.isTyping ? "Typing..." : "");

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = window.setTimeout(() => {
        setTypingText("");
      }, 1500);
    };

    const onGroupUpdated = (payload: {
      type?: string;
      groupId?: string;
      userId?: string;
    }) => {
      void reloadGroups();

      if (payload.groupId && payload.groupId === activeGroupId) {
        void fetchGroupDetail(payload.groupId)
          .then((detail) => {
            setSelectedGroupDetail(detail);
          })
          .catch(() => {
            // Keep current detail if refresh fails.
          });
      }
    };

    const onPresence = (payload: {
      userId: string;
      isOnline: boolean;
      lastSeenAt: string | null;
    }) => {
      setPresenceByUser((prev) => ({
        ...prev,
        [payload.userId]: {
          isOnline: payload.isOnline,
          lastSeenAt: payload.lastSeenAt,
        },
      }));
    };

    socket.on(CHAT_EVENTS.MESSAGE, onMessage);
    socket.on(CHAT_EVENTS.DELETED, onDeleted);
    socket.on(CHAT_EVENTS.RECALLED, onRecalled);
    socket.on(CHAT_EVENTS.TYPING, onTyping);
    socket.on(CHAT_EVENTS.PRESENCE, onPresence);
    socket.on(CALL_EVENTS.INCOMING, onIncomingCall);
    socket.on(GROUP_EVENTS.MESSAGE, onGroupMessage);
    socket.on(GROUP_EVENTS.DELETED, onGroupDeleted);
    socket.on(GROUP_EVENTS.RECALLED, onGroupRecalled);
    socket.on(GROUP_EVENTS.TYPING, onGroupTyping);
    socket.on(GROUP_EVENTS.UPDATED, onGroupUpdated);

    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      socket.off(CHAT_EVENTS.MESSAGE, onMessage);
      socket.off(CHAT_EVENTS.DELETED, onDeleted);
      socket.off(CHAT_EVENTS.RECALLED, onRecalled);
      socket.off(CHAT_EVENTS.TYPING, onTyping);
      socket.off(CHAT_EVENTS.PRESENCE, onPresence);
      socket.off(CALL_EVENTS.INCOMING, onIncomingCall);
      socket.off(GROUP_EVENTS.MESSAGE, onGroupMessage);
      socket.off(GROUP_EVENTS.DELETED, onGroupDeleted);
      socket.off(GROUP_EVENTS.RECALLED, onGroupRecalled);
      socket.off(GROUP_EVENTS.TYPING, onGroupTyping);
      socket.off(GROUP_EVENTS.UPDATED, onGroupUpdated);
    };
  }, [activeGroupId, currentUserId, peerUserId, reloadGroups, roomByPeer]);

  useEffect(() => {
    if (!isCreateGroupModalOpen) {
      return;
    }

    let mounted = true;
    setIsLoadingGroupFriends(true);

    void fetchAllFriends()
      .then((items) => {
        if (!mounted) return;
        setGroupFriends(items);
      })
      .catch(() => {
        if (!mounted) return;
        setGroupFriends([]);
      })
      .finally(() => {
        if (!mounted) return;
        setIsLoadingGroupFriends(false);
      });

    return () => {
      mounted = false;
    };
  }, [isCreateGroupModalOpen]);

  useEffect(() => {
    const listElement = listRef.current;
    if (!listElement) return;
    listElement.scrollTo({
      top: listElement.scrollHeight,
      behavior: "smooth",
    });
  }, [activeMessages, activeGroupMessages]);

  const handleSend = (content: string) => {
    if (!socketRef.current || !peerUserId || !effectiveActiveRoomId) return;

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

  const handleDelete = (messageId: string) => {
    socketRef.current?.emit(CHAT_EVENTS.DELETE, { messageId });
  };

  const handleRecall = (messageId: string) => {
    socketRef.current?.emit(CHAT_EVENTS.RECALL, { messageId });
  };

  const handleCreateGroup = async (payload: {
    name: string;
    avatarUrl?: string;
    description?: string;
    memberIds: string[];
  }) => {
    const created = await createGroup({
      name: payload.name,
      avatarUrl: payload.avatarUrl,
      description: payload.description,
    });

    const uniqueMemberIds = Array.from(new Set(payload.memberIds)).filter(
      (memberId) => memberId && memberId !== currentUserId,
    );

    for (const memberId of uniqueMemberIds) {
      await addGroupMember(created.groupId, memberId);
    }

    await reloadGroups();
    setIsCreateGroupModalOpen(false);
    setPanelNotice(`Đã tạo nhóm: ${created.name}`);
    void handleSelectGroup(created.groupId);
  };

  const handleSendGroupMessage = (content: string) => {
    if (!activeGroupId || !socketRef.current) return;

    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    if (replyTo) {
      socketRef.current.emit(GROUP_EVENTS.REPLY, {
        groupId: activeGroupId,
        content: trimmedContent,
        replyToMessageId: replyTo.messageId,
      });
      setReplyTo(undefined);
      return;
    }

    socketRef.current.emit(GROUP_EVENTS.SEND, {
      groupId: activeGroupId,
      content: trimmedContent,
    });
  };

  const handleDeleteGroupMessage = (messageId: string) => {
    if (!activeGroupId) return;

    socketRef.current?.emit(GROUP_EVENTS.DELETE, {
      groupId: activeGroupId,
      messageId,
    });
  };

  const handleRecallGroupMessage = (messageId: string) => {
    if (!activeGroupId) return;

    socketRef.current?.emit(GROUP_EVENTS.RECALL, {
      groupId: activeGroupId,
      messageId,
    });
  };

  const handleGroupVoiceCall = async () => {
    if (!activeGroupId) return;

    const result = await updateGroupCallState(activeGroupId, "voice", "active");
    setSelectedGroupDetail((current) =>
      current
        ? {
            ...current,
            callState: {
              groupId: result.groupId,
              mode: result.mode,
              state: result.state,
              startedBy: result.startedBy,
              startedAt: result.startedAt,
              updatedAt: result.updatedAt,
            },
          }
        : current,
    );
    setPanelNotice("Đã bật cuộc gọi voice cho nhóm");
  };

  const handleGroupVideoCall = async () => {
    if (!activeGroupId) return;

    const result = await updateGroupCallState(activeGroupId, "video", "active");
    setSelectedGroupDetail((current) =>
      current
        ? {
            ...current,
            callState: {
              groupId: result.groupId,
              mode: result.mode,
              state: result.state,
              startedBy: result.startedBy,
              startedAt: result.startedAt,
              updatedAt: result.updatedAt,
            },
          }
        : current,
    );
    setPanelNotice("Đã bật cuộc gọi video cho nhóm");
  };

  const handleClearGroupHistory = () => {
    if (!activeGroupId) return;

    setGroupMessagesByGroup((prev) => ({
      ...prev,
      [activeGroupId]: [],
    }));
    setSelectedMessage(null);
    setPanelNotice("Đã xóa lịch sử trò chuyện nhóm");
  };

  const handleLeaveGroup = async () => {
    if (!activeGroupId) return;

    await leaveGroup(activeGroupId);
    setGroupMessagesByGroup((prev) => {
      const next = { ...prev };
      delete next[activeGroupId];
      return next;
    });
    setActiveGroupId("");
    setSelectedGroupDetail(null);
    setSelectedMessage(null);
    setPanelNotice("Bạn đã rời nhóm");
    await reloadGroups();
  };

  const handleDisbandGroup = async () => {
    if (!activeGroupId) return;

    await disbandGroup(activeGroupId);
    setGroupMessagesByGroup((prev) => {
      const next = { ...prev };
      delete next[activeGroupId];
      return next;
    });
    setActiveGroupId("");
    setSelectedGroupDetail(null);
    setSelectedMessage(null);
    setPanelNotice("Nhóm đã được giải tán");
    await reloadGroups();
  };

  const handleTyping = (isTyping: boolean) => {
    if (activeGroupId) {
      socketRef.current?.emit(GROUP_EVENTS.TYPING, {
        groupId: activeGroupId,
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
    setIncomingCall(null);
    setCallDirection(null);
    void sendChatAction("decline_call", {
      peerUserId: incomingCall.senderId,
      metadata: { sessionId: incomingCall.sessionId },
    });
  };

  const handleCloseCall = useCallback(() => {
    setCallMode(null);
    setCallDirection(null);
  }, []);

  return (
    <section className="h-full w-full overflow-hidden bg-[#f8f9fb]">
      <div className="flex h-full min-w-0">
        <ChatSidebar
          rooms={sidebarRooms}
          groups={groups}
          activeRoomId={effectiveActiveRoomId}
          onSelectRoom={handleSelectRoom}
          onSelectGroup={handleSelectGroup}
          onCreateGroup={openCreateGroupModal}
        />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-[#f8f9fb] lg:min-h-0">
          {!isLoadingRooms &&
          !effectiveActiveRoomId &&
          !activeGroupId &&
          !selectedGroupDetail ? (
            <ChatNoRoomWelcome />
          ) : activeGroupId ? (
            <div className="grid min-h-0 flex-1 items-stretch grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="flex min-h-0 flex-col">
                <ChatHeader
                  peerName={
                    (selectedGroupDetail ?? selectedGroupSummary)?.name ??
                    "Group"
                  }
                  orderTitle={
                    (selectedGroupDetail ?? selectedGroupSummary)
                      ?.description ??
                    `${(selectedGroupDetail ?? selectedGroupSummary)?.memberCount ?? 0} members`
                  }
                  typingText={typingText}
                  onOpenVoiceCall={handleGroupVoiceCall}
                  onOpenVideoCall={handleGroupVideoCall}
                />

                <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3 lg:px-6 lg:pb-4 lg:pt-4">
                  <MessageList
                    messages={activeGroupMessages}
                    currentUserId={currentUserId}
                    listRef={listRef}
                    onReply={setReplyTo}
                    onDelete={handleDeleteGroupMessage}
                    onRecall={handleRecallGroupMessage}
                    onSelectMessage={setSelectedMessage}
                    className="flex-1"
                  />
                  <div className="mt-2 lg:mt-3">
                    <MessageInput
                      replyTo={replyTo}
                      onClearReply={() => setReplyTo(undefined)}
                      onSend={handleSendGroupMessage}
                      onTyping={handleTyping}
                    />
                  </div>
                </div>
              </div>

              <ConversationInfoPanel
                currentUserId={currentUserId}
                peerName={
                  (selectedGroupDetail ?? selectedGroupSummary)?.name ?? "Group"
                }
                peerUserId={
                  (selectedGroupDetail ?? selectedGroupSummary)?.groupId ??
                  activeGroupId
                }
                isOnline={false}
                lastSeenAt={null}
                selectedMessage={selectedMessage}
                onCreateGroup={openCreateGroupModal}
                onClearGroupHistory={handleClearGroupHistory}
                onLeaveGroup={handleLeaveGroup}
                onDisbandGroup={handleDisbandGroup}
                notice={panelNotice}
                selectedGroup={selectedGroupDetail ?? selectedGroupSummary}
                groupMessages={activeGroupMessages}
              />
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 items-stretch grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="flex min-h-0 flex-col">
                <ChatHeader
                  peerName={peerName}
                  orderTitle={orderTitle}
                  typingText={typingText}
                  onOpenVoiceCall={openVoiceCall}
                  onOpenVideoCall={openVideoCall}
                />

                <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3 lg:px-6 lg:pb-4 lg:pt-4">
                  <MessageList
                    messages={activeMessages}
                    currentUserId={currentUserId}
                    listRef={listRef}
                    onReply={setReplyTo}
                    onDelete={handleDelete}
                    onRecall={handleRecall}
                    onSelectMessage={setSelectedMessage}
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
              </div>

              <ConversationInfoPanel
                currentUserId={currentUserId}
                peerName={peerName}
                peerUserId={peerUserId}
                isOnline={peerPresence.isOnline}
                lastSeenAt={peerPresence.lastSeenAt}
                selectedMessage={selectedMessage}
                onCreateGroup={openCreateGroupModal}
                notice={panelNotice}
                selectedGroup={selectedGroupDetail}
              />
            </div>
          )}
        </div>
      </div>

      <IncomingCallModal
        isOpen={incomingCall !== null}
        senderName={incomingCall?.senderName ?? ""}
        callMode={incomingCall?.callMode ?? "voice"}
        isOnline={incomingCall?.isOnline ?? false}
        onAccept={handleAcceptIncomingCall}
        onDecline={handleDeclineIncomingCall}
      />

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

      <CreateGroupModal
        isOpen={isCreateGroupModalOpen}
        currentPeerUserId={peerUserId}
        currentPeerName={peerName}
        friends={groupFriends}
        loadingFriends={isLoadingGroupFriends}
        onClose={() => setIsCreateGroupModalOpen(false)}
        onSubmit={handleCreateGroup}
      />
    </section>
  );
}
