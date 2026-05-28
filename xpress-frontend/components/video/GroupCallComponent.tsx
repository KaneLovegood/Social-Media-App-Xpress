"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { CHAT_EVENTS } from "@/lib/realtime/events";
import {
  GroupCallAnswerPayload,
  GroupCallEndPayload,
  GroupCallIcePayload,
  GroupCallOfferPayload,
  GroupCallStartedPayload,
} from "@/lib/realtime/types";
import { GroupRoomDetails } from "@/lib/chat-groups";

type CallMode = "voice" | "video";

interface GroupCallComponentProps {
  socket: Socket | null;
  currentUserId: string;
  currentUserName: string;
  callHostUserId: string;
  roomId: string;
  groupDetails: GroupRoomDetails;
  callMode: CallMode;
  callDirection: "incoming" | "outgoing";
  onClose: () => void;
}

interface RemoteStreamState {
  userId: string;
  name: string;
  stream: MediaStream | null;
}

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

function formatDuration(value: number): string {
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function initials(value: string): string {
  const words = value.split(/[\s._-]+/).filter(Boolean);
  const chars = words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "");
  return chars.join("") || "GC";
}

function StreamVideo({
  stream,
  muted,
  className,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.srcObject = stream;
    if (stream) {
      void element.play().catch(() => {
        // Autoplay can lag one tick; the next render or user interaction can retry.
      });
    }
  }, [stream]);

  useEffect(() => {
    const element = ref.current;
    if (!element || !stream) return;

    const handleTrackChange = () => {
      element.srcObject = stream;
      void element.play().catch(() => {
        // Retry is handled by the next stream update.
      });
    };

    stream.addEventListener("addtrack", handleTrackChange);
    stream.addEventListener("removetrack", handleTrackChange);

    return () => {
      stream.removeEventListener("addtrack", handleTrackChange);
      stream.removeEventListener("removetrack", handleTrackChange);
    };
  }, [stream]);

  return (
    <video ref={ref} autoPlay playsInline muted={muted} className={className} />
  );
}

export default function GroupCallComponent({
  socket,
  currentUserId,
  currentUserName,
  callHostUserId,
  roomId,
  groupDetails,
  callMode,
  callDirection,
  onClose,
}: GroupCallComponentProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map(),
  );
  const pendingOffersRef = useRef<Map<string, GroupCallOfferPayload>>(
    new Map(),
  );
  const retryOfferTimersRef = useRef<Map<string, number>>(new Map());
  const remoteStreamsRef = useRef<RemoteStreamState[]>([]);
  const remoteMediaStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const startedRef = useRef(false);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamState[]>([]);
  const [inCallMemberIds, setInCallMemberIds] = useState<string[]>(() => {
    const initial = new Set<string>([currentUserId]);
    if (callHostUserId) {
      initial.add(callHostUserId);
    }
    return Array.from(initial);
  });
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const participants = useMemo<RemoteStreamState[]>(() => {
    const byUserId = new Map<string, RemoteStreamState>();

    byUserId.set(currentUserId, {
      userId: currentUserId,
      name: currentUserName,
      stream: localStream,
    });

    for (const stream of remoteStreams) {
      byUserId.set(stream.userId, stream);
    }

    const roster = inCallMemberIds.map((userId) => {
      const member = groupDetails.members.find(
        (item) => item.userId === userId,
      );
      return (
        byUserId.get(userId) ?? {
          userId,
          name: member?.name ?? userId,
          stream: null,
        }
      );
    });

    if (!roster.find((item) => item.userId === currentUserId)) {
      roster.unshift({
        userId: currentUserId,
        name: currentUserName,
        stream: localStream,
      });
    }

    return roster;
  }, [
    currentUserId,
    currentUserName,
    groupDetails.members,
    inCallMemberIds,
    localStream,
    remoteStreams,
  ]);

  const videoParticipants = useMemo(() => {
    if (callMode !== "video") return [] as RemoteStreamState[];
    return participants;
  }, [callMode, participants]);

  const videoGridColumns = useMemo(() => {
    const count = Math.max(1, videoParticipants.length);
    if (count <= 1) return 1;
    if (count === 2) return 2;
    if (count === 3) return 3;
    if (count <= 4) return 2;
    if (count <= 6) return 3;
    return 4;
  }, [videoParticipants.length]);

  const remoteMembers = useMemo(
    () =>
      groupDetails.members.filter((member) => member.userId !== currentUserId),
    [currentUserId, groupDetails.members],
  );

  // ...existing code...

  useEffect(() => {
    remoteStreamsRef.current = remoteStreams;
  }, [remoteStreams]);

  useEffect(() => {
    setInCallMemberIds((prev) => {
      const next = new Set(prev);
      next.add(currentUserId);
      if (callHostUserId) {
        next.add(callHostUserId);
      }
      return Array.from(next);
    });
  }, [callHostUserId, currentUserId]);

  const addInCallMember = useCallback((userId: string) => {
    if (!userId) return;

    setInCallMemberIds((prev) => {
      if (prev.includes(userId)) return prev;
      return [...prev, userId];
    });
  }, []);

  const removeInCallMember = useCallback(
    (userId: string) => {
      if (!userId || userId === currentUserId) return;

      remoteMediaStreamsRef.current.delete(userId);
      setInCallMemberIds((prev) => prev.filter((id) => id !== userId));
      setRemoteStreams((prev) => prev.filter((item) => item.userId !== userId));
    },
    [currentUserId],
  );

  const resolveEndReason = useCallback(() => {
    if (callDirection === "outgoing" && remoteStreamsRef.current.length === 0) {
      return "cancelled";
    }

    return "ended";
  }, [callDirection]);

  const stopConference = useCallback(
    (
      notifyRoom: boolean,
      reason?: "ended" | "cancelled" | "left",
      endForAll = true,
    ) => {
      if (notifyRoom && socket) {
        socket.emit(CHAT_EVENTS.GROUP_CALL_END, {
          senderId: currentUserId,
          roomId,
          callMode,
          reason: reason ?? resolveEndReason(),
          endForAll,
        } satisfies GroupCallEndPayload);
      }

      for (const [userId, peer] of peerConnectionsRef.current.entries()) {
        peer.close();
        peerConnectionsRef.current.delete(userId);
      }

      for (const stream of remoteStreamsRef.current) {
        if (stream.stream) {
          stream.stream.getTracks().forEach((track) => track.stop());
        }
      }

      const localStream = localStreamRef.current;
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
        setLocalStream(null);
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }

      remoteMediaStreamsRef.current.clear();
      pendingIceCandidatesRef.current.clear();
      pendingOffersRef.current.clear();
      for (const timerId of retryOfferTimersRef.current.values()) {
        window.clearTimeout(timerId);
      }
      retryOfferTimersRef.current.clear();
      startedRef.current = false;
      setRemoteStreams([]);
      setInCallMemberIds(() => {
        const base = new Set<string>([currentUserId]);
        if (callHostUserId) {
          base.add(callHostUserId);
        }
        return Array.from(base);
      });
      setMuted(false);
      setCameraOff(false);
      setElapsedSeconds(0);
      setIsActive(false);

      if (notifyRoom) {
        onClose();
      }
    },
    [
      callHostUserId,
      callMode,
      currentUserId,
      onClose,
      resolveEndReason,
      roomId,
      socket,
    ],
  );

  const clearRetryOfferTimer = useCallback((remoteUserId: string) => {
    const timerId = retryOfferTimersRef.current.get(remoteUserId);
    if (timerId) {
      window.clearTimeout(timerId);
      retryOfferTimersRef.current.delete(remoteUserId);
    }
  }, []);

  const emitIceCandidate = useCallback(
    (receiverId: string, candidate: RTCIceCandidateInit) => {
      if (!socket) return;

      socket.emit(CHAT_EVENTS.GROUP_CALL_ICE, {
        senderId: currentUserId,
        roomId,
        receiverId,
        callMode,
        candidate,
      } satisfies GroupCallIcePayload);
    },
    [callMode, roomId, socket, currentUserId],
  );

  const ensurePeerConnection = useCallback(
    async (remoteUserId: string) => {
      const existing = peerConnectionsRef.current.get(remoteUserId);
      if (existing) return existing;

      const localStream = localStreamRef.current;
      if (!localStream) {
        throw new Error("Local stream not ready");
      }

      const peer = new RTCPeerConnection(rtcConfig);
      peerConnectionsRef.current.set(remoteUserId, peer);

      localStream.getTracks().forEach((track) => {
        peer.addTrack(track, localStream);
      });

      peer.ontrack = (event) => {
        const remoteStream =
          remoteMediaStreamsRef.current.get(remoteUserId) ?? new MediaStream();

        if (!remoteMediaStreamsRef.current.has(remoteUserId)) {
          remoteMediaStreamsRef.current.set(remoteUserId, remoteStream);
        }

        if (!remoteStream.getTracks().includes(event.track)) {
          remoteStream.addTrack(event.track);
        }

        clearRetryOfferTimer(remoteUserId);
        addInCallMember(remoteUserId);

        setRemoteStreams((prev) => {
          const next = prev.filter((item) => item.userId !== remoteUserId);
          const participant =
            groupDetails.members.find(
              (member) => member.userId === remoteUserId,
            )?.name ?? remoteUserId;
          next.push({
            userId: remoteUserId,
            name: participant,
            stream: remoteStream,
          });
          return next;
        });
      };

      peer.onicecandidate = (event) => {
        if (!event.candidate) return;
        emitIceCandidate(remoteUserId, event.candidate.toJSON());
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") {
          clearRetryOfferTimer(remoteUserId);
        }
      };

      return peer;
    },
    [
      addInCallMember,
      clearRetryOfferTimer,
      emitIceCandidate,
      groupDetails.members,
    ],
  );

  const createAndSendOffer = useCallback(
    async (remoteUserId: string, force = false) => {
      if (!socket || !localStreamRef.current) return false;
      if (remoteUserId === currentUserId) return false;

      const shouldInitiate = currentUserId < remoteUserId;
      if (!force && !shouldInitiate) {
        return false;
      }

      const hasRemoteStream = remoteStreamsRef.current.some(
        (item) => item.userId === remoteUserId && item.stream,
      );
      if (hasRemoteStream) {
        clearRetryOfferTimer(remoteUserId);
        return true;
      }

      const peer = await ensurePeerConnection(remoteUserId);
      if (peer.signalingState !== "stable") {
        if (force) {
          try {
            await peer.setLocalDescription({ type: "rollback" });
          } catch {
            return false;
          }
        } else {
          return false;
        }
      }

      const offer = await peer.createOffer({ iceRestart: force });
      await peer.setLocalDescription(offer);

      socket.emit(CHAT_EVENTS.GROUP_CALL_OFFER, {
        senderId: currentUserId,
        roomId,
        receiverId: remoteUserId,
        callMode,
        offer,
      } satisfies GroupCallOfferPayload);

      return true;
    },
    [
      callMode,
      clearRetryOfferTimer,
      currentUserId,
      ensurePeerConnection,
      roomId,
      socket,
    ],
  );

  const scheduleOfferRetry = useCallback(
    (remoteUserId: string) => {
      clearRetryOfferTimer(remoteUserId);

      const timerId = window.setTimeout(() => {
        void createAndSendOffer(remoteUserId, true)
          .then((sent) => {
            if (!sent) {
              scheduleOfferRetry(remoteUserId);
            }
          })
          .catch(() => {
            scheduleOfferRetry(remoteUserId);
          });
      }, 3000);

      retryOfferTimersRef.current.set(remoteUserId, timerId);
    },
    [clearRetryOfferTimer, createAndSendOffer],
  );

  const flushPendingIce = useCallback(async (remoteUserId: string) => {
    const peer = peerConnectionsRef.current.get(remoteUserId);
    if (!peer || !peer.remoteDescription) return;

    const queued = pendingIceCandidatesRef.current.get(remoteUserId) ?? [];
    pendingIceCandidatesRef.current.delete(remoteUserId);

    for (const candidate of queued) {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }, []);

  const handlePendingOffers = useCallback(async () => {
    const entries = Array.from(pendingOffersRef.current.values());
    if (entries.length === 0) return;

    pendingOffersRef.current.clear();

    for (const payload of entries) {
      if (payload.roomId !== roomId || payload.receiverId !== currentUserId) {
        continue;
      }

      const peer = await ensurePeerConnection(payload.senderId);
      await peer.setRemoteDescription(new RTCSessionDescription(payload.offer));
      await flushPendingIce(payload.senderId);

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket?.emit(CHAT_EVENTS.GROUP_CALL_ANSWER, {
        senderId: currentUserId,
        roomId,
        receiverId: payload.senderId,
        callMode: payload.callMode,
        answer,
      } satisfies GroupCallAnswerPayload);
    }
  }, [currentUserId, ensurePeerConnection, flushPendingIce, roomId, socket]);

  const startConference = useCallback(async () => {
    if (!socket || startedRef.current) return;

    startedRef.current = true;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callMode === "video",
    });

    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    setLocalStream(stream);
    setIsActive(true);

    // Bao hiem race condition: host gui offer truoc khi member mount → offer mat.
    // Moi participant sau khi co stream se emit GROUP_CALL_START de bao "san sang".
    // Cac participant dang trong call nhan duoc se gui offer lai dung luc da co listener.
    socket.emit(CHAT_EVENTS.GROUP_CALL_START, { roomId, callMode });

    await handlePendingOffers();

    for (const member of remoteMembers) {
      const sent = await createAndSendOffer(member.userId);
      if (sent) {
        scheduleOfferRetry(member.userId);
      }
    }
  }, [
    callMode,
    createAndSendOffer,
    handlePendingOffers,
    remoteMembers,
    roomId,
    scheduleOfferRetry,
    socket,
  ]);

  useEffect(() => {
    if (!socket || !roomId) return;

    const onStarted = async (payload: GroupCallStartedPayload) => {
      if (payload.roomId !== roomId) return;

      addInCallMember(payload.senderId);

      if (!startedRef.current) {
        // Chua start → start ngay
        try {
          await startConference();
        } catch {
          stopConference(false);
        }
        return;
      }

      // Da trong call → thanh vien moi vua san sang (phat hien qua GROUP_CALL_START).
      // Neu currentUserId < newJoiner thi ta gui offer cho ho.
      // Neu currentUserId > newJoiner thi newJoiner se tu offer ta (trong startConference cua ho).
      const newJoinerId = payload.senderId;
      if (!newJoinerId || newJoinerId === currentUserId) return;
      if (!localStreamRef.current) return;
      if (peerConnectionsRef.current.has(newJoinerId)) return;

      try {
        const sent = await createAndSendOffer(newJoinerId);
        if (sent) {
          scheduleOfferRetry(newJoinerId);
        }
      } catch {
        // Ignore
      }
    };

    const onOffer = async (payload: GroupCallOfferPayload) => {
      if (payload.roomId !== roomId || payload.receiverId !== currentUserId) {
        return;
      }

      if (!localStreamRef.current) {
        pendingOffersRef.current.set(payload.senderId, payload);
        return;
      }

      const peer = await ensurePeerConnection(payload.senderId);
      if (peer.signalingState !== "stable") {
        try {
          await peer.setLocalDescription({ type: "rollback" });
        } catch {
          // Ignore rollback errors. In-flight negotiation may finish naturally.
        }
      }
      await peer.setRemoteDescription(new RTCSessionDescription(payload.offer));
      await flushPendingIce(payload.senderId);

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket.emit(CHAT_EVENTS.GROUP_CALL_ANSWER, {
        senderId: currentUserId,
        roomId,
        receiverId: payload.senderId,
        callMode: payload.callMode,
        answer,
      } satisfies GroupCallAnswerPayload);
    };

    const onAnswer = async (payload: GroupCallAnswerPayload) => {
      if (payload.roomId !== roomId || payload.receiverId !== currentUserId) {
        return;
      }

      const peer = peerConnectionsRef.current.get(payload.senderId);
      if (!peer) return;

      await peer.setRemoteDescription(
        new RTCSessionDescription(payload.answer),
      );
      await flushPendingIce(payload.senderId);
    };

    const onIce = async (payload: GroupCallIcePayload) => {
      if (payload.roomId !== roomId || payload.receiverId !== currentUserId) {
        return;
      }

      const peer = peerConnectionsRef.current.get(payload.senderId);
      if (!peer || !peer.remoteDescription) {
        const queued =
          pendingIceCandidatesRef.current.get(payload.senderId) ?? [];
        queued.push(payload.candidate);
        pendingIceCandidatesRef.current.set(payload.senderId, queued);
        return;
      }

      await peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
    };

    const onEnd = (payload: GroupCallEndPayload) => {
      if (payload.roomId !== roomId) return;

      if (!payload.endForAll && payload.senderId !== currentUserId) {
        const leaverId = payload.senderId;
        const peer = peerConnectionsRef.current.get(leaverId);
        if (peer) {
          peer.close();
          peerConnectionsRef.current.delete(leaverId);
        }

        pendingIceCandidatesRef.current.delete(leaverId);
        pendingOffersRef.current.delete(leaverId);
        clearRetryOfferTimer(leaverId);
        removeInCallMember(leaverId);
        return;
      }

      stopConference(false);
      onClose();
    };

    socket.on(CHAT_EVENTS.GROUP_CALL_STARTED, onStarted);
    socket.on(CHAT_EVENTS.GROUP_CALL_OFFER, onOffer);
    socket.on(CHAT_EVENTS.GROUP_CALL_ANSWER, onAnswer);
    socket.on(CHAT_EVENTS.GROUP_CALL_ICE, onIce);
    socket.on(CHAT_EVENTS.GROUP_CALL_END, onEnd);

    return () => {
      socket.off(CHAT_EVENTS.GROUP_CALL_STARTED, onStarted);
      socket.off(CHAT_EVENTS.GROUP_CALL_OFFER, onOffer);
      socket.off(CHAT_EVENTS.GROUP_CALL_ANSWER, onAnswer);
      socket.off(CHAT_EVENTS.GROUP_CALL_ICE, onIce);
      socket.off(CHAT_EVENTS.GROUP_CALL_END, onEnd);
    };
  }, [
    callMode,
    createAndSendOffer,
    currentUserId,
    flushPendingIce,
    scheduleOfferRetry,
    onClose,
    roomId,
    socket,
    startConference,
    stopConference,
    ensurePeerConnection,
    addInCallMember,
    clearRetryOfferTimer,
    removeInCallMember,
  ]);

  useEffect(() => {
    if (
      !socket ||
      !roomId ||
      !groupDetails.members.length ||
      startedRef.current
    ) {
      return;
    }

    if (callDirection !== "outgoing" && callDirection !== "incoming") {
      return;
    }

    // Defer startConference to avoid synchronous setState inside effect
    setTimeout(() => {
      void startConference().catch(() => {
        stopConference(false);
      });
    }, 0);
  }, [
    callDirection,
    groupDetails.members.length,
    roomId,
    socket,
    startConference,
    stopConference,
  ]);

  useEffect(() => {
    if (!isActive) return;

    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isActive]);

  useEffect(
    () => () => {
      stopConference(false);
    },
    [stopConference],
  );

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const next = !muted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const next = !cameraOff;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !next;
    });
    setCameraOff(next);
  };

  const handleEnd = () => {
    stopConference(true, "left", false);
  };

  return (
    <section className="fixed inset-0 z-50 bg-[#e8ebf3] animate-fade-in">
      <div className="relative flex h-full w-full flex-col overflow-hidden px-4 pb-24 pt-4 md:px-6 md:pb-6">
        <div className="flex items-center justify-between rounded-2xl bg-white/75 px-4 py-3 shadow-sm backdrop-blur">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6d7790]">
              Group {callMode === "video" ? "Video" : "Voice"} Call
            </p>
            <h2 className="mt-1 truncate text-lg font-bold text-[#0f1c3c]">
              {groupDetails.title}
            </h2>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#6d7790]">
              {callDirection === "outgoing" ? "Đang gọi" : "Đang tham gia"}
            </p>
            <p className="text-sm font-semibold text-[#0f1c3c]">
              {formatDuration(elapsedSeconds)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          {callMode === "video" ? (
            <div
              className="grid min-h-0 flex-1 gap-3 overflow-y-auto"
              style={{
                gridTemplateColumns: `repeat(${videoGridColumns}, minmax(0, 1fr))`,
                gridAutoRows: "minmax(0, 1fr)",
              }}
            >
              {videoParticipants.length > 0 ? (
                videoParticipants.map((participant) => (
                  <div
                    key={participant.userId}
                    className="relative h-full min-h-0 overflow-hidden rounded-3xl bg-[#15213e] shadow-lg"
                  >
                    {participant.stream ? (
                      <StreamVideo
                        stream={participant.stream}
                        muted={participant.userId === currentUserId}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#1c294b]">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#dfe7fb] text-lg font-bold text-[#28437f]">
                          {initials(participant.name)}
                        </div>
                      </div>
                    )}
                    <div className="absolute left-3 top-3 rounded-full bg-black/45 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                      {participant.userId === currentUserId
                        ? "Bạn"
                        : participant.name}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex min-h-80 items-center justify-center rounded-3xl border border-dashed border-[#c9d3ea] bg-white/60 text-center text-sm text-[#5f6d89]">
                  <div>
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#dfe7fb] text-2xl font-bold text-[#28437f]">
                      {initials(groupDetails.title)}
                    </div>
                    <p className="mt-4">Đang chờ các thành viên kết nối...</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto md:grid-cols-3 xl:grid-cols-4">
              {participants.map((participant) => (
                <div
                  key={participant.userId}
                  className="flex min-h-45 flex-col items-center justify-center rounded-3xl border border-[#d7def0] bg-white/75 px-4 py-5 text-center shadow-sm"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#dfe7fb] text-lg font-bold text-[#28437f]">
                    {initials(participant.name)}
                  </div>
                  <p className="mt-3 truncate text-sm font-semibold text-[#0f1c3c]">
                    {participant.name}
                  </p>
                  <p className="mt-1 text-xs text-[#6d7790]">
                    {participant.userId === currentUserId
                      ? "Bạn"
                      : "Đã kết nối"}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="absolute bottom-6 left-1/2 w-[calc(100%-28px)] max-w-180 -translate-x-1/2 rounded-4xl bg-white/80 px-4 py-3 shadow-[0_24px_40px_rgba(18,27,51,0.12)] backdrop-blur">
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={toggleMute}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#eef2f7] text-[#243356]"
                aria-label="Toggle mute"
              >
                {muted ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="m4 4 16 16" />
                    <path d="M12 4v7" />
                    <path d="M9 11a3 3 0 1 0 6 0" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0" />
                    <path d="M12 18v3" />
                  </svg>
                )}
              </button>

              {callMode === "video" ? (
                <button
                  type="button"
                  onClick={toggleCamera}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#eef2f7] text-[#243356]"
                  aria-label="Toggle camera"
                >
                  {cameraOff ? (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="m4 4 16 16" />
                      <rect x="3" y="6" width="13" height="12" rx="2" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="6" width="13" height="12" rx="2" />
                      <path d="m16 10 5-3v10l-5-3" />
                    </svg>
                  )}
                </button>
              ) : null}

              <button
                type="button"
                onClick={handleEnd}
                className="inline-flex h-16 min-w-28 items-center justify-center rounded-full bg-[#c21d2f] px-4 text-sm font-semibold text-white"
              >
                End Call
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
