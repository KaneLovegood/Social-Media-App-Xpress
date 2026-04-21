import { useState } from "react";

type CallMode = "voice" | "video" | null;
type CallDirection = "incoming" | "outgoing" | null;

interface IncomingCall {
  senderId: string;
  senderName: string;
  callMode: "voice" | "video";
  sessionId: string;
  isOnline: boolean;
}

interface PendingGroupCall {
  roomId: string;
  callMode: "voice" | "video";
  senderId: string;
}

export function useCallState() {
  const [callMode, setCallMode] = useState<CallMode>(null);
  const [callDirection, setCallDirection] = useState<CallDirection>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  const [groupCallRoomId, setGroupCallRoomId] = useState("");
  const [groupCallMode, setGroupCallMode] = useState<CallMode>(null);
  const [groupCallDirection, setGroupCallDirection] =
    useState<CallDirection>(null);
  const [groupCallHostUserId, setGroupCallHostUserId] = useState("");
  const [pendingGroupCall, setPendingGroupCall] =
    useState<PendingGroupCall | null>(null);

  // Reset private call state
  const resetPrivateCall = () => {
    setCallMode(null);
    setCallDirection(null);
  };

  // Reset group call state
  const resetGroupCall = () => {
    setGroupCallRoomId("");
    setGroupCallMode(null);
    setGroupCallDirection(null);
    setGroupCallHostUserId("");
  };

  return {
    // Private call
    callMode,
    setCallMode,
    callDirection,
    setCallDirection,
    incomingCall,
    setIncomingCall,
    resetPrivateCall,

    // Group call
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
    resetGroupCall,
  };
}
