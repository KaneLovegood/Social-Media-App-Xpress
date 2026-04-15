import { useCallback } from 'react';
import { sendChatAction } from '@/lib/chat-actions';

type CallMode = 'voice' | 'video' | null;
type CallDirection = 'incoming' | 'outgoing' | null;

interface CallHandlersProps {
  peerUserId: string;
  currentUserId: string;
  activeRoomId: string;
  setCallMode: (mode: CallMode) => void;
  setCallDirection: (direction: CallDirection) => void;
  setIncomingCall: (call: any | null) => void;
  setGroupCallRoomId: (roomId: string) => void;
  setGroupCallMode: (mode: CallMode) => void;
  setGroupCallDirection: (direction: CallDirection) => void;
  setPendingGroupCall: (call: any | null) => void;
}

export function useCallHandlers(props: CallHandlersProps) {
  const {
    peerUserId,
    currentUserId,
    activeRoomId,
    setCallMode,
    setCallDirection,
    setIncomingCall,
    setGroupCallRoomId,
    setGroupCallMode,
    setGroupCallDirection,
    setPendingGroupCall,
  } = props;

  const openVoiceCall = useCallback(() => {
    if (!peerUserId) return;
    setCallDirection('outgoing');
    setCallMode('voice');
    void sendChatAction('open_voice_call', {
      peerUserId,
      metadata: { triggeredBy: currentUserId },
    });
  }, [peerUserId, currentUserId, setCallDirection, setCallMode]);

  const openVideoCall = useCallback(() => {
    if (!peerUserId) return;
    setCallDirection('outgoing');
    setCallMode('video');
    void sendChatAction('open_video_call', {
      peerUserId,
      metadata: { triggeredBy: currentUserId },
    });
  }, [peerUserId, currentUserId, setCallDirection, setCallMode]);

  const handleAcceptIncomingCall = useCallback(
    (incomingCall: any) => {
      if (!incomingCall) return;
      setCallDirection('incoming');
      setCallMode(incomingCall.callMode);
      setIncomingCall(null);
      void sendChatAction('accept_call', {
        peerUserId: incomingCall.senderId,
        metadata: { sessionId: incomingCall.sessionId },
      });
    },
    [setCallDirection, setCallMode, setIncomingCall],
  );

  const handleDeclineIncomingCall = useCallback(
    (incomingCall: any, socketRef: any) => {
      if (!incomingCall) return;
      socketRef?.current?.emit('call:end', {
        receiverId: incomingCall.senderId,
        reason: 'declined',
      });
      setIncomingCall(null);
      setCallDirection(null);
      setCallMode(null);
      void sendChatAction('decline_call', {
        peerUserId: incomingCall.senderId,
        metadata: { sessionId: incomingCall.sessionId },
      });
    },
    [setIncomingCall, setCallDirection, setCallMode],
  );

  const handleAcceptGroupCall = useCallback(
    (pendingGroupCall: any) => {
      if (!pendingGroupCall) return;

      setGroupCallRoomId(pendingGroupCall.roomId);
      setGroupCallMode(pendingGroupCall.callMode);
      setGroupCallDirection('incoming');
      setPendingGroupCall(null);
    },
    [setGroupCallRoomId, setGroupCallMode, setGroupCallDirection, setPendingGroupCall],
  );

  const handleDeclineGroupCall = useCallback(() => {
    setPendingGroupCall(null);
  }, [setPendingGroupCall]);

  return {
    openVoiceCall,
    openVideoCall,
    handleAcceptIncomingCall,
    handleDeclineIncomingCall,
    handleAcceptGroupCall,
    handleDeclineGroupCall,
  };
}
