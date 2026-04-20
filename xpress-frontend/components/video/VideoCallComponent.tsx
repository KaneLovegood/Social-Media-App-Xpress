import { useCallback, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { sendChatAction } from '@/lib/chat-actions';
import { CALL_EVENTS } from '@/lib/realtime/events';
import {
  CallAnswerPayload,
  CallEndPayload,
  CallIcePayload,
  CallOfferPayload,
} from '@/lib/realtime/types';
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

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export default function VideoCallComponent({
  socket,
  currentUserId,
  peerUserId,
  peerName,
  orderTitle,
  callMode,
  callDirection,
  onModeChange,
  onClose,
}: VideoCallComponentProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<RTCSessionDescriptionInit | null>(null);
  const [active, setActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [speakerBoost, setSpeakerBoost] = useState(false);
  const [ringSeconds, setRingSeconds] = useState(0);
  const [hasStartedCall, setHasStartedCall] = useState(false);
  const [isAudioActive, setIsAudioActive] = useState(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const silenceFramesRef = useRef(0);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const showOverlay = callMode !== null;
  const isVoiceMode = callMode === 'voice';
  const isVideoMode = callMode === 'video';

  const stopAudioActivityMonitor = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioSourceRef.current) {
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    silenceFramesRef.current = 0;
    setIsAudioActive(false);
  }, []);

  const flushPendingIceCandidates = useCallback(async () => {
    const peer = peerRef.current;
    if (!peer || !peer.remoteDescription) {
      return;
    }

    const queued = pendingIceCandidatesRef.current;
    pendingIceCandidatesRef.current = [];

    for (const candidate of queued) {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }, []);

  const startAudioActivityMonitor = useCallback((stream: MediaStream) => {
    const hasAudioTrack = stream.getAudioTracks().length > 0;
    if (!hasAudioTrack) {
      stopAudioActivityMonitor();
      return;
    }

    stopAudioActivityMonitor();

    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.75;

    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);

    audioContextRef.current = context;
    analyserRef.current = analyser;
    audioSourceRef.current = source;

    void context.resume();

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const threshold = 0.02;
    const silenceFramesToStop = 12;

    const checkLevel = () => {
      analyser.getByteTimeDomainData(dataArray);

      let sumSquares = 0;
      for (const sample of dataArray) {
        const normalized = (sample - 128) / 128;
        sumSquares += normalized * normalized;
      }

      const rms = Math.sqrt(sumSquares / dataArray.length);
      if (rms > threshold) {
        silenceFramesRef.current = 0;
        setIsAudioActive(true);
      } else {
        silenceFramesRef.current += 1;
        if (silenceFramesRef.current >= silenceFramesToStop) {
          setIsAudioActive(false);
        }
      }

      animationFrameRef.current = window.requestAnimationFrame(checkLevel);
    };

    animationFrameRef.current = window.requestAnimationFrame(checkLevel);
  }, [stopAudioActivityMonitor]);

  const setupPeer = useCallback(async (withVideo: boolean) => {
    if (typeof window === 'undefined') {
      throw new Error('This feature requires a browser environment.');
    }

    // Fallback cho getUserMedia trên các trình duyệt/webview cũ hoặc môi trường dev (HTTP)
    const nav = navigator as unknown as {
      getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
      webkitGetUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
      mozGetUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
    };

    const getUserMedia = (
      navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices) ||
      nav.getUserMedia?.bind(navigator) ||
      nav.webkitGetUserMedia?.bind(navigator) ||
      nav.mozGetUserMedia?.bind(navigator)
    );

    if (!getUserMedia) {
      alert('🔒 BẢO MẬT: Webview chặn Camera vì bạn đang test qua IP HTTP mạng LAN. Hãy comment { server: url } trong capacitor.config.ts đi, chạy lệnh npx cap sync lại, khi đó app sẽ chạy local và có Camera.');
      throw new Error('Môi trường HTTP IP nội bộ bị chặn WebRTC.');
    }

    const stream = await getUserMedia({
      audio: true,
      video: withVideo ? { facingMode: 'user' } : false,
    });
    localStreamRef.current = stream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    const peer = new RTCPeerConnection(rtcConfig);
    peerRef.current = peer;

    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream);
    });

    peer.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
      startAudioActivityMonitor(remoteStream);
    };

    peer.onicecandidate = (event) => {
      if (!event.candidate || !socket) return;
      socket.emit(CALL_EVENTS.ICE, {
        receiverId: peerUserId,
        candidate: event.candidate.toJSON(),
      });
    };

    return peer;
  }, [peerUserId, socket, startAudioActivityMonitor]);

  const startCall = useCallback(async (withVideo: boolean) => {
    if (!socket) return;

    const peer = await setupPeer(withVideo);
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    socket.emit(CALL_EVENTS.OFFER, {
      receiverId: peerUserId,
      offer,
    });

    setHasStartedCall(true);
    setRingSeconds(0);
  }, [peerUserId, setupPeer, socket]);

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

    const peer = peerRef.current;
    if (peer) {
      peer.close();
      peerRef.current = null;
    }

    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    pendingIceCandidatesRef.current = [];

    setIncomingOffer(null);
    setActive(false);
    setHasStartedCall(false);
    setMuted(false);
    setCameraOff(false);
    setSpeakerBoost(false);
    setRingSeconds(0);
    stopAudioActivityMonitor();

    if (closeUi) {
      onClose();
    }
  }, [currentUserId, onClose, peerUserId, socket, stopAudioActivityMonitor]);

  const acceptIncomingCall = useCallback(async () => {
    if (!incomingOffer || !socket) return;

    const peer = await setupPeer(callMode === 'video');
    await peer.setRemoteDescription(new RTCSessionDescription(incomingOffer));
    await flushPendingIceCandidates();

    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    socket.emit(CALL_EVENTS.ANSWER, {
      receiverId: peerUserId,
      answer,
    });

    setIncomingOffer(null);
    setHasStartedCall(true);
    setActive(true);
    setRingSeconds(0);
    await sendChatAction('accept_call', { peerUserId, metadata: { triggeredBy: currentUserId } });
  }, [callMode, currentUserId, flushPendingIceCandidates, incomingOffer, peerUserId, setupPeer, socket]);

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

  useEffect(() => {
    if (!active) return;

    const timer = window.setInterval(() => {
      setRingSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [active]);

  useEffect(() => {
    if (!socket) return;

    const onOffer = (payload: CallOfferPayload) => {
      if (payload.senderId !== peerUserId || payload.receiverId !== currentUserId) return;
      setIncomingOffer(payload.offer);
    };

    const onAnswer = async (payload: CallAnswerPayload) => {
      if (payload.senderId !== peerUserId || payload.receiverId !== currentUserId) return;
      const peer = peerRef.current;
      if (!peer) return;
      await peer.setRemoteDescription(new RTCSessionDescription(payload.answer));
      await flushPendingIceCandidates();
      setHasStartedCall(true);
      setActive(true);
      setRingSeconds(0);
    };

    const onIce = async (payload: CallIcePayload) => {
      if (payload.senderId !== peerUserId || payload.receiverId !== currentUserId) return;
      const peer = peerRef.current;
      if (!peer || !peer.remoteDescription) {
        pendingIceCandidatesRef.current.push(payload.candidate);
        return;
      }
      await peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
    };

    const onEnd = (payload: CallEndPayload) => {
      if (payload.senderId !== peerUserId || payload.receiverId !== currentUserId) return;
      void stopCall(false, true);
    };

    socket.on(CALL_EVENTS.OFFER, onOffer);
    socket.on(CALL_EVENTS.ANSWER, onAnswer);
    socket.on(CALL_EVENTS.ICE, onIce);
    socket.on(CALL_EVENTS.END, onEnd);

    return () => {
      socket.off(CALL_EVENTS.OFFER, onOffer);
      socket.off(CALL_EVENTS.ANSWER, onAnswer);
      socket.off(CALL_EVENTS.ICE, onIce);
      socket.off(CALL_EVENTS.END, onEnd);
      void stopCall(false, true);
    };
  }, [currentUserId, flushPendingIceCandidates, peerUserId, socket, stopCall]);

  useEffect(() => {
    if (!showOverlay || !socket || active || incomingOffer || hasStartedCall) return;
    if (callDirection !== 'outgoing') return;

    const shouldStart = callMode === 'voice' || callMode === 'video';
    if (!shouldStart) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void startCall(callMode === 'video');
  }, [active, callDirection, callMode, hasStartedCall, incomingOffer, showOverlay, socket, startCall]);

  useEffect(() => {
    if (!showOverlay || active || !incomingOffer) return;
    if (callDirection !== 'incoming') return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void acceptIncomingCall();
  }, [acceptIncomingCall, active, callDirection, incomingOffer, showOverlay]);

  useEffect(() => () => {
    stopAudioActivityMonitor();
  }, [stopAudioActivityMonitor]);

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

  const formatDuration = (value: number) => `${Math.floor(value / 60)
    .toString()
    .padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;

  if (!showOverlay) return null;

  if (isVoiceMode) {
    const isIncomingRinging = Boolean(incomingOffer) && !active;
    const isConnected = active;
    const canShowWave = isConnected && isAudioActive;
    return (
      <AudioCallOverlay
        peerName={peerName}
        timerText={isConnected ? formatDuration(ringSeconds) : 'Calling...'}
        statusLabel={isConnected ? 'Connected' : isIncomingRinging ? 'Incoming' : 'Connecting'}
        isConnected={isConnected}
        isIncomingRinging={isIncomingRinging}
        canShowWave={canShowWave}
        muted={muted}
        speakerBoost={speakerBoost}
        onToggleMute={toggleMute}
        onSwitchToVideo={() => void switchToVideoCall()}
        onToggleSpeaker={() => setSpeakerBoost((prev) => !prev)}
        onEndCall={() => void stopCall(true, true)}
        onAcceptIncoming={() => void acceptIncomingCall()}
        onDeclineIncoming={() => void declineCall()}
        remoteAudioRef={remoteAudioRef}
      />
    );
  }

  if (!isVideoMode) return null;

  return (
    <VideoCallOverlay
      localVideoRef={localVideoRef}
      remoteVideoRef={remoteVideoRef}
      timerText={formatDuration(ringSeconds)}
      muted={muted}
      cameraOff={cameraOff}
      onToggleMute={toggleMute}
      onToggleCamera={toggleCamera}
      onEndCall={() => void stopCall(true, true)}
    />
  );
}
