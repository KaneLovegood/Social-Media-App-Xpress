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
    if (ref.current) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video ref={ref} autoPlay playsInline muted={muted} className={className} />
  );
}

export default function GroupCallComponent({
  socket,
  currentUserId,
  currentUserName,
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
  const remoteStreamsRef = useRef<RemoteStreamState[]>([]);
  const startedRef = useRef(false);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamState[]>([]);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const remoteMembers = useMemo(
    () =>
      groupDetails.members.filter((member) => member.userId !== currentUserId),
    [currentUserId, groupDetails.members],
  );

  // ...existing code...

  useEffect(() => {
    remoteStreamsRef.current = remoteStreams;
  }, [remoteStreams]);

  const stopConference = useCallback(
    (notifyRoom: boolean) => {
      if (notifyRoom && socket) {
        socket.emit(CHAT_EVENTS.GROUP_CALL_END, {
          senderId: currentUserId,
          roomId,
          reason: "ended",
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

      pendingIceCandidatesRef.current.clear();
      startedRef.current = false;
      setRemoteStreams([]);
      setMuted(false);
      setCameraOff(false);
      setElapsedSeconds(0);
      setIsActive(false);

      if (notifyRoom) {
        onClose();
      }
    },
    [currentUserId, onClose, roomId, socket],
  );

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
        const [remoteStream] = event.streams;
        if (!remoteStream) return;

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

      return peer;
    },
    [emitIceCandidate, groupDetails.members],
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

    for (const member of remoteMembers) {
      const shouldInitiate = currentUserId < member.userId;
      if (!shouldInitiate) {
        continue;
      }

      const peer = await ensurePeerConnection(member.userId);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      socket.emit(CHAT_EVENTS.GROUP_CALL_OFFER, {
        senderId: currentUserId,
        roomId,
        receiverId: member.userId,
        callMode,
        offer,
      } satisfies GroupCallOfferPayload);
    }
  }, [
    callMode,
    currentUserId,
    ensurePeerConnection,
    remoteMembers,
    roomId,
    socket,
  ]);

  useEffect(() => {
    if (!socket || !roomId) return;

    const onStarted = async (payload: GroupCallStartedPayload) => {
      if (payload.roomId !== roomId) return;
      if (startedRef.current) return;

      try {
        await startConference();
      } catch {
        stopConference(false);
      }
    };

    const onOffer = async (payload: GroupCallOfferPayload) => {
      if (payload.roomId !== roomId || payload.receiverId !== currentUserId) {
        return;
      }

      const peer = await ensurePeerConnection(payload.senderId);
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
    currentUserId,
    flushPendingIce,
    onClose,
    roomId,
    socket,
    startConference,
    stopConference,
    ensurePeerConnection,
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
    stopConference(true);
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
            <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
              {remoteStreams.length > 0 ? (
                remoteStreams.map((participant) => (
                  <div
                    key={participant.userId}
                    className="relative min-h-55 overflow-hidden rounded-3xl bg-[#15213e] shadow-lg"
                  >
                    <StreamVideo
                      stream={participant.stream}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute left-3 top-3 rounded-full bg-black/45 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                      {participant.name}
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
              {[
                {
                  userId: currentUserId,
                  name: currentUserName,
                  stream: localStream,
                } as RemoteStreamState,
                ...remoteStreams,
              ].map((participant) => (
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
