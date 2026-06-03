import { useCallback, useEffect, useState, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { sendChatAction, fetchAgoraToken } from '@/lib/chat-actions';
import { CALL_EVENTS } from '@/lib/realtime/events';
import {
  CallEndPayload,
  CallAnswerPayload,
  CallOfferPayload,
} from '@/lib/realtime/types';
import { useAgora } from '@/hooks/useAgora';
import AudioCallOverlay from './AudioCallOverlay';
import VideoCallOverlay from './VideoCallOverlay';

type CallMode = 'voice' | 'video' | null;
type CallDirection = 'incoming' | 'outgoing' | null;

interface VideoCallComponentProps {
  socket: Socket | null;
  currentUserId: string;
  peerUserId: string;
  peerName: string;
  orderTitle: string;
  callMode: CallMode;
  callDirection: CallDirection;
  onModeChange: (mode: CallMode) => void;
  onClose: () => void;
}

const AGORA_APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || '';

export default function VideoCallComponent({
  socket,
  currentUserId,
  peerUserId,
  peerName,
  callMode,
  callDirection,
  onModeChange,
  onClose,
}: VideoCallComponentProps) {
  // Agora Client
  const client = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
  }, []);

  const {
    localAudioTrack,
    localVideoTrack,
    remoteUsers,
    join,
    leave,
  } = useAgora(client);

  const [incomingOffer, setIncomingOffer] =
    useState<RTCSessionDescriptionInit | null>(null);
  const [active, setActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [speakerBoost, setSpeakerBoost] = useState(false);
  const [ringSeconds, setRingSeconds] = useState(0);
  const [hasStartedCall, setHasStartedCall] = useState(false);

  const showOverlay = callMode !== null;
  const isVoiceMode = callMode === 'voice';
  const isVideoMode = callMode === 'video';

  // Channel name logic: unique for the pair of users (max 64 chars for Agora)
  const channelName = useMemo(() => {
    return [currentUserId, peerUserId]
      .map((id) => id.replace(/-/g, ''))
      .sort()
      .join('');
  }, [currentUserId, peerUserId]);

  const stopCall = useCallback(async (
    notifyPeer: boolean,
    closeUi: boolean,
    skipEndAction = false,
  ) => {
    if (notifyPeer && socket) {
      socket.emit(CALL_EVENTS.END, {
        receiverId: peerUserId,
        reason: 'ended',
      });

      if (!skipEndAction) {
        await sendChatAction('end_call', { peerUserId, metadata: { triggeredBy: currentUserId } });
      }
    }

    await leave();

    setIncomingOffer(null);
    setActive(false);
    setHasStartedCall(false);
    setMuted(false);
    setCameraOff(false);
    setSpeakerBoost(false);
    setRingSeconds(0);

    if (closeUi) {
      onClose();
    }
  }, [currentUserId, leave, onClose, peerUserId, socket]);

  const startCall = useCallback(async () => {
    if (!socket || !AGORA_APP_ID) return;

    try {
      const { token } = await fetchAgoraToken(channelName);
      await join(AGORA_APP_ID, channelName, token, currentUserId, callMode === 'video');
      
      // Notify peer via socket (Legacy WebRTC event names used for ringing)
      socket.emit(CALL_EVENTS.OFFER, {
        receiverId: peerUserId,
        offer: { type: 'offer', sdp: 'agora' }, // Placeholder for Agora
      });

      setHasStartedCall(true);
      setRingSeconds(0);
    } catch (error) {
      console.error('Failed to start call:', error);
    }
  }, [callMode, channelName, currentUserId, join, peerUserId, socket]);

  const acceptIncomingCall = useCallback(async () => {
    if (!incomingOffer || !socket || !AGORA_APP_ID) return;

    try {
      const { token } = await fetchAgoraToken(channelName);
      await join(AGORA_APP_ID, channelName, token, currentUserId, callMode === 'video');

      socket.emit(CALL_EVENTS.ANSWER, {
        receiverId: peerUserId,
        answer: { type: 'answer', sdp: 'agora' }, // Placeholder
      });

      setIncomingOffer(null);
      setHasStartedCall(true);
      setActive(true);
      setRingSeconds(0);
      await sendChatAction('accept_call', { peerUserId, metadata: { triggeredBy: currentUserId } });
    } catch (error) {
      console.error('Failed to accept call:', error);
    }
  }, [callMode, channelName, currentUserId, incomingOffer, join, peerUserId, socket]);

  const declineCall = useCallback(async () => {
    await sendChatAction('decline_call', { peerUserId, metadata: { triggeredBy: currentUserId } });
    await stopCall(true, true, true);
  }, [currentUserId, peerUserId, stopCall]);

  const switchToVideoCall = useCallback(async () => {
    await stopCall(true, false);
    onModeChange('video');
    await sendChatAction('open_video_call', {
      peerUserId,
      metadata: { triggeredBy: currentUserId, from: 'audio_overlay_camera_button' },
    });
  }, [currentUserId, onModeChange, peerUserId, stopCall]);

  // Timer
  useEffect(() => {
    if (!active) return;

    const timer = window.setInterval(() => {
      setRingSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [active]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const onOffer = (payload: CallOfferPayload) => {
      if (payload.senderId !== peerUserId || payload.receiverId !== currentUserId) return;
      setIncomingOffer(payload.offer);
    };

    const onAnswer = (payload: CallAnswerPayload) => {
      if (payload.senderId !== peerUserId || payload.receiverId !== currentUserId) return;
      setHasStartedCall(true);
      setActive(true);
      setRingSeconds(0);
    };

    const onEnd = (payload: CallEndPayload) => {
      if (payload.senderId !== peerUserId || payload.receiverId !== currentUserId) return;
      void stopCall(false, true);
    };

    socket.on(CALL_EVENTS.OFFER, onOffer);
    socket.on(CALL_EVENTS.ANSWER, onAnswer);
    socket.on(CALL_EVENTS.END, onEnd);

    return () => {
      socket.off(CALL_EVENTS.OFFER, onOffer);
      socket.off(CALL_EVENTS.ANSWER, onAnswer);
      socket.off(CALL_EVENTS.END, onEnd);
      void stopCall(false, true);
    };
  }, [currentUserId, peerUserId, socket, stopCall]);

  // Auto-start or Auto-accept
  useEffect(() => {
    if (!showOverlay || !socket || active || incomingOffer || hasStartedCall) return;
    if (callDirection !== 'outgoing') return;

    const shouldStart = callMode === 'voice' || callMode === 'video';
    if (!shouldStart) return;

    const timerId = window.setTimeout(() => {
      void startCall();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [active, callDirection, callMode, hasStartedCall, incomingOffer, showOverlay, socket, startCall]);

  useEffect(() => {
    if (!showOverlay || active || !incomingOffer) return;
    if (callDirection !== 'incoming') return;

    const timerId = window.setTimeout(() => {
      void acceptIncomingCall();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [acceptIncomingCall, active, callDirection, incomingOffer, showOverlay]);

  const toggleMute = () => {
    if (localAudioTrack) {
      localAudioTrack.setEnabled(muted);
      setMuted(!muted);
    }
  };

  const toggleCamera = () => {
    if (localVideoTrack) {
      localVideoTrack.setEnabled(cameraOff);
      setCameraOff(!cameraOff);
    }
  };

  const formatDuration = (value: number) => `${Math.floor(value / 60)
    .toString()
    .padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;

  if (!showOverlay) return null;

  const remoteUser = remoteUsers[0]; // Agora simple 1:1

  if (isVoiceMode) {
    const isIncomingRinging = Boolean(incomingOffer) && !active;
    const isConnected = active;
    return (
      <AudioCallOverlay
        peerName={peerName}
        timerText={isConnected ? formatDuration(ringSeconds) : 'Calling...'}
        statusLabel={isConnected ? 'Connected' : isIncomingRinging ? 'Incoming' : 'Connecting'}
        isConnected={isConnected}
        isIncomingRinging={isIncomingRinging}
        canShowWave={isConnected}
        muted={muted}
        speakerBoost={speakerBoost}
        onToggleMute={toggleMute}
        onSwitchToVideo={() => void switchToVideoCall()}
        onToggleSpeaker={() => setSpeakerBoost((prev) => !prev)}
        onEndCall={() => void stopCall(true, true)}
        onAcceptIncoming={() => void acceptIncomingCall()}
        onDeclineIncoming={() => void declineCall()}
        remoteAudioTrack={remoteUser?.audioTrack ?? null}
      />
    );
  }

  if (!isVideoMode) return null;

  return (
    <VideoCallOverlay
      localVideoTrack={localVideoTrack}
      remoteVideoTrack={remoteUser?.videoTrack ?? null}
      remoteAudioTrack={remoteUser?.audioTrack ?? null}
      isRemoteVideoReady={Boolean(remoteUser?.videoTrack)}
      timerText={formatDuration(ringSeconds)}
      muted={muted}
      cameraOff={cameraOff}
      onToggleMute={toggleMute}
      onToggleCamera={toggleCamera}
      onEndCall={() => void stopCall(true, true)}
    />
  );
}
