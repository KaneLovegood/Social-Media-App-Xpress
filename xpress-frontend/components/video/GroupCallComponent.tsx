"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AgoraRTC, {
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IRemoteAudioTrack,
  IRemoteVideoTrack,
} from "agora-rtc-sdk-ng";
import { Socket } from "socket.io-client";
import { fetchAgoraToken } from "@/lib/chat-actions";
import { GroupRoomDetails } from "@/lib/chat-groups";
import { CHAT_EVENTS } from "@/lib/realtime/events";
import {
  GroupCallEndPayload,
  GroupCallStartedPayload,
} from "@/lib/realtime/types";
import { useAgora } from "@/hooks/useAgora";

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
  onLeave: () => void;
  onClose: () => void;
}

interface ParticipantView {
  userId: string;
  name: string;
  isLocal: boolean;
  remoteUser?: IAgoraRTCRemoteUser;
}

const AGORA_APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || "";

function formatDuration(value: number): string {
  const minutes = Math.floor(value / 60).toString().padStart(2, "0");
  const seconds = (value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function initials(value: string): string {
  const words = value.split(/[\s._-]+/).filter(Boolean);
  const chars = words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "");
  return chars.join("") || "GC";
}

function toAgoraGroupChannel(roomId: string): string {
  return `grp${roomId.replace(/[^a-zA-Z0-9]/g, "")}`.slice(0, 64);
}

function memberName(groupDetails: GroupRoomDetails, userId: string): string {
  return (
    groupDetails.members.find((member) => member.userId === userId)?.name ??
    userId
  );
}

function AgoraVideo({
  track,
  className,
}: {
  track: ICameraVideoTrack | IRemoteVideoTrack | null;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !track) return;

    element.replaceChildren();
    track.play(element);

    return () => {
      track.stop();
      element.replaceChildren();
    };
  }, [track]);

  return <div ref={ref} className={className} />;
}

function AgoraAudio({ track, speakerBoost }: { track: IRemoteAudioTrack | null; speakerBoost: boolean }) {
  useEffect(() => {
    if (!track) return;
    track.play();
    return () => track.stop();
  }, [track]);

  useEffect(() => {
    if (!track) return;
    track.setVolume(speakerBoost ? 1000 : 100);
  }, [track, speakerBoost]);

  return null;
}

export default function GroupCallComponent({
  socket,
  currentUserId,
  currentUserName,
  roomId,
  groupDetails,
  callMode,
  callDirection,
  onLeave,
  onClose,
}: GroupCallComponentProps) {
  const client = useMemo(() => {
    if (typeof window === "undefined") return null;
    return AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
  }, []);

  const {
    localAudioTrack,
    localVideoTrack,
    remoteUsers,
    joinState,
    join,
    leave,
    switchCamera,
  } = useAgora(client);

  const onLeaveRef = useRef(onLeave);
  const onCloseRef = useRef(onClose);
  const startedRef = useRef(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(callMode !== "video");
  const [speakerBoost, setSpeakerBoost] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [joining, setJoining] = useState(true);
  const [joinError, setJoinError] = useState("");
  const [inCallMemberIds, setInCallMemberIds] = useState<string[]>([
    currentUserId,
  ]);

  const channelName = useMemo(() => toAgoraGroupChannel(roomId), [roomId]);

  useEffect(() => {
    onLeaveRef.current = onLeave;
  }, [onLeave]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const remoteUserById = useMemo(() => {
    const byId = new Map<string, IAgoraRTCRemoteUser>();
    for (const user of remoteUsers) {
      byId.set(String(user.uid), user);
    }
    return byId;
  }, [remoteUsers]);

  const participants = useMemo<ParticipantView[]>(() => {
    const orderedIds = new Set<string>([currentUserId]);
    inCallMemberIds.forEach((userId) => orderedIds.add(userId));
    remoteUsers.forEach((user) => orderedIds.add(String(user.uid)));

    return Array.from(orderedIds).map((userId) => ({
      userId,
      name:
        userId === currentUserId
          ? currentUserName
          : memberName(groupDetails, userId),
      isLocal: userId === currentUserId,
      remoteUser: remoteUserById.get(userId),
    }));
  }, [
    currentUserId,
    currentUserName,
    groupDetails,
    inCallMemberIds,
    remoteUserById,
    remoteUsers,
  ]);

  const videoGridClass = useMemo(() => {
    const count = Math.max(1, participants.length);
    if (count <= 1) return "grid-cols-1";
    if (count === 2) return "grid-cols-1 sm:grid-cols-2";
    if (count <= 4) return "grid-cols-2";
    return "grid-cols-2 lg:grid-cols-3";
  }, [participants.length]);

  const stopConference = useCallback(
    async (
      notifyRoom: boolean,
      reason: "ended" | "cancelled" | "left" = "left",
      endForAll = false,
    ) => {
      if (notifyRoom && socket) {
        socket.emit(CHAT_EVENTS.GROUP_CALL_END, {
          senderId: currentUserId,
          roomId,
          callMode,
          reason,
          endForAll,
        } satisfies GroupCallEndPayload);
      }

      startedRef.current = false;
      setJoining(false);
      setElapsedSeconds(0);
      setMuted(false);
      setCameraOff(callMode !== "video");
      setInCallMemberIds([currentUserId]);
      await leave();

      if (notifyRoom) {
        if (endForAll) {
          onCloseRef.current();
        } else {
          onLeaveRef.current();
        }
      }
    },
    [callMode, currentUserId, leave, roomId, socket],
  );

  useEffect(() => {
    if (!socket || !roomId) return;

    const onStarted = (payload: GroupCallStartedPayload) => {
      if (payload.roomId !== roomId) return;
      setInCallMemberIds((prev) => {
        const next = new Set(prev);
        next.add(currentUserId);
        payload.activeParticipantIds?.forEach((userId) => {
          if (userId) next.add(userId);
        });
        if (payload.senderId) next.add(payload.senderId);
        return Array.from(next);
      });
    };

    const onEnd = (payload: GroupCallEndPayload) => {
      if (payload.roomId !== roomId) return;

      if (!payload.endForAll && payload.senderId !== currentUserId) {
        setInCallMemberIds((prev) =>
          prev.filter((userId) => userId !== payload.senderId),
        );
        return;
      }

      void stopConference(false).then(() => {
        if (!payload.endForAll && payload.senderId === currentUserId) {
          onLeaveRef.current();
          return;
        }
        onCloseRef.current();
      });
    };

    socket.on(CHAT_EVENTS.GROUP_CALL_STARTED, onStarted);
    socket.on(CHAT_EVENTS.GROUP_CALL_END, onEnd);

    return () => {
      socket.off(CHAT_EVENTS.GROUP_CALL_STARTED, onStarted);
      socket.off(CHAT_EVENTS.GROUP_CALL_END, onEnd);
    };
  }, [currentUserId, roomId, socket, stopConference]);

  useEffect(() => {
    if (!socket || !AGORA_APP_ID || startedRef.current) return;

    startedRef.current = true;

    const timerId = window.setTimeout(() => {
      void (async () => {
        try {
          setJoining(true);
          setJoinError("");
          const { token } = await fetchAgoraToken(channelName);
          await join(
            AGORA_APP_ID,
            channelName,
            token,
            currentUserId,
            callMode === "video",
          );

          socket.emit(CHAT_EVENTS.GROUP_CALL_START, {
            senderId: currentUserId,
            roomId,
            callMode,
          });

          setJoining(false);
        } catch (error) {
          startedRef.current = false;
          setJoining(false);
          setJoinError(
            error instanceof Error
              ? error.message
              : "Khong the ket noi cuoc goi nhom.",
          );
        }
      })();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [callMode, channelName, currentUserId, join, roomId, socket]);

  useEffect(() => {
    if (!joinState) return;

    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [joinState]);

  useEffect(
    () => () => {
      void stopConference(false);
    },
    [stopConference],
  );

  const toggleMute = () => {
    if (!localAudioTrack) return;

    const next = !muted;
    void localAudioTrack.setEnabled(!next);
    setMuted(next);
  };

  const toggleCamera = () => {
    if (!localVideoTrack) return;

    const next = !cameraOff;
    void localVideoTrack.setEnabled(!next);
    setCameraOff(next);
  };

  const handleEnd = () => {
    void stopConference(true, "left", false);
  };

  return (
    <section className="fixed inset-0 z-[1000] bg-[#e8ebf3] animate-fade-in">
      <div className="flex h-full w-full flex-col overflow-hidden px-3 py-3 sm:px-4 md:px-6">
        <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6d7790] sm:text-[11px]">
              Group {callMode === "video" ? "Video" : "Voice"} Call
            </p>
            <h2 className="mt-0.5 truncate text-base font-bold leading-tight text-[#0f1c3c] sm:text-lg">
              {groupDetails.title}
            </h2>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] text-[#6d7790] sm:text-xs">
              {joining
                ? "Dang ket noi"
                : callDirection === "outgoing"
                  ? "Dang goi"
                  : "Dang tham gia"}
            </p>
            <p className="text-sm font-semibold tabular-nums text-[#0f1c3c]">
              {formatDuration(elapsedSeconds)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden md:mt-4">
          {callMode === "video" ? (
            <div
              className={`grid min-h-0 flex-1 ${videoGridClass} auto-rows-[minmax(0,1fr)] gap-2 overflow-hidden sm:gap-3`}
            >
              {participants.map((participant) => {
                const videoTrack = participant.isLocal
                  ? localVideoTrack
                  : (participant.remoteUser?.videoTrack ?? null);
                const audioTrack = participant.isLocal
                  ? null
                  : (participant.remoteUser?.audioTrack ?? null);
                const hasVideo =
                  Boolean(videoTrack) &&
                  !(participant.isLocal && cameraOff);

                return (
                  <div
                    key={participant.userId}
                    className="relative min-h-0 overflow-hidden rounded-2xl bg-[#15213e] shadow-lg md:rounded-3xl"
                  >
                    {hasVideo ? (
                      <AgoraVideo
                        track={videoTrack}
                        className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#1c294b] px-4 text-center">
                        <div>
                          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#dfe7fb] text-lg font-bold text-[#28437f]">
                            {initials(participant.name)}
                          </div>
                          <p className="mt-3 text-xs font-semibold text-white/80">
                            {participant.isLocal && cameraOff
                              ? "Camera dang tat"
                              : "Dang ket noi video..."}
                          </p>
                        </div>
                      </div>
                    )}
                    <AgoraAudio track={audioTrack} speakerBoost={speakerBoost} />
                    <div className="absolute left-3 top-3 max-w-[75%] truncate rounded-full bg-black/45 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                      {participant.isLocal ? "Ban" : participant.name}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-2 auto-rows-[minmax(0,1fr)] gap-3 overflow-hidden md:grid-cols-3 xl:grid-cols-4">
              {participants.map((participant) => (
                <div
                  key={participant.userId}
                  className="flex min-h-0 flex-col items-center justify-center rounded-3xl border border-[#d7def0] bg-white/75 px-4 py-5 text-center shadow-sm"
                >
                  <AgoraAudio
                    track={participant.remoteUser?.audioTrack ?? null}
                    speakerBoost={speakerBoost}
                  />
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#dfe7fb] text-lg font-bold text-[#28437f]">
                    {initials(participant.name)}
                  </div>
                  <p className="mt-3 truncate text-sm font-semibold text-[#0f1c3c]">
                    {participant.name}
                  </p>
                  <p className="mt-1 text-xs text-[#6d7790]">
                    {participant.isLocal ? "Ban" : "Da ket noi"}
                  </p>
                </div>
              ))}
            </div>
          )}

          {joinError ? (
            <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700">
              {joinError}
            </div>
          ) : null}

          <div className="shrink-0 rounded-4xl bg-white/85 px-4 py-3 shadow-[0_18px_36px_rgba(18,27,51,0.12)] backdrop-blur sm:mx-auto sm:w-fit sm:min-w-90">
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

              <button
                type="button"
                onClick={() => setSpeakerBoost((prev) => !prev)}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${speakerBoost ? 'bg-[#152b58] text-white' : 'bg-[#eef2f7] text-[#243356]'}`}
                aria-label="Tối đa âm lượng"
                title={speakerBoost ? "Khôi phục âm lượng thường" : "Tối đa âm lượng"}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 10v4h4l5 4V6l-5 4H3Z" />
                  <path d="M16 9a4 4 0 0 1 0 6" />
                  <path d="M18.5 6.5a7 7 0 0 1 0 11" />
                </svg>
              </button>

              {callMode === "video" ? (
                <>
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
                  {!cameraOff && (
                    <button
                      type="button"
                      onClick={switchCamera}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#eef2f7] text-[#243356]"
                      aria-label="Switch camera"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 2v6h-6" />
                        <path d="M3 22v-6h6" />
                        <path d="M21 13a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                        <path d="M3 11a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                      </svg>
                    </button>
                  )}
                </>
              ) : null}

              <button
                type="button"
                onClick={handleEnd}
                className="inline-flex h-14 min-w-24 items-center justify-center rounded-full bg-[#c21d2f] px-4 text-sm font-semibold text-white md:h-16 md:min-w-28"
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
