import { useCallback, useEffect, useRef, useState } from 'react';
import AgoraRTC, {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng';

export const useAgora = (client: IAgoraRTCClient | null) => {
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [joinState, setJoinState] = useState(false);
  
  const tracksRef = useRef<{ audio: IMicrophoneAudioTrack | null; video: ICameraVideoTrack | null }>({
    audio: null,
    video: null,
  });
  const isJoining = useRef(false);

  const leave = useCallback(async () => {
    isJoining.current = false;
    
    const { audio, video } = tracksRef.current;
    if (audio) {
      audio.stop();
      audio.close();
    }
    if (video) {
      video.stop();
      video.close();
    }
    
    tracksRef.current = { audio: null, video: null };
    setLocalAudioTrack(null);
    setLocalVideoTrack(null);
    setRemoteUsers([]);
    setJoinState(false);

    if (client && client.connectionState !== 'DISCONNECTED') {
      try {
        await client.leave();
      } catch (err) {
        console.warn('Agora leave failed:', err);
      }
    }
  }, [client]);

  const join = useCallback(
    async (appId: string, channel: string, token: string, uid?: string | number | null) => {
      if (!client || isJoining.current) return;

      isJoining.current = true;
      try {
        await client.join(appId, channel, token, uid);

        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();

        if (!isJoining.current) {
          audioTrack.stop();
          audioTrack.close();
          videoTrack.stop();
          videoTrack.close();
          await client.leave();
          return;
        }

        tracksRef.current = { audio: audioTrack, video: videoTrack };
        setLocalAudioTrack(audioTrack);
        setLocalVideoTrack(videoTrack);

        await client.publish([audioTrack, videoTrack]);
        setJoinState(true);
      } catch (error) {
        console.error('Agora join failed:', error);
        isJoining.current = false;
        throw error;
      }
    },
    [client]
  );

  useEffect(() => {
    if (!client) return;

    const handleUserPublished = async (user: any, mediaType: 'audio' | 'video') => {
      await client.subscribe(user, mediaType);
      setRemoteUsers((prevUsers) => {
        const existing = prevUsers.find((u) => u.uid === user.uid);
        if (existing) {
          return prevUsers.map((u) => (u.uid === user.uid ? user : u));
        }
        return [...prevUsers, user];
      });
    };

    const handleUserUnpublished = (user: any) => {
      setRemoteUsers((prevUsers) => prevUsers.filter((u) => u.uid !== user.uid));
    };

    const handleUserJoined = (user: any) => {
      setRemoteUsers((prevUsers) => {
        if (prevUsers.find((u) => u.uid === user.uid)) return prevUsers;
        return [...prevUsers, user];
      });
    };

    const handleUserLeft = (user: any) => {
      setRemoteUsers((prevUsers) => prevUsers.filter((u) => u.uid !== user.uid));
    };

    client.on('user-published', handleUserPublished);
    client.on('user-unpublished', handleUserUnpublished);
    client.on('user-joined', handleUserJoined);
    client.on('user-left', handleUserLeft);

    return () => {
      client.off('user-published', handleUserPublished);
      client.off('user-unpublished', handleUserUnpublished);
      client.off('user-joined', handleUserJoined);
      client.off('user-left', handleUserLeft);
    };
  }, [client]);

  return {
    localAudioTrack,
    localVideoTrack,
    remoteUsers,
    joinState,
    join,
    leave,
  };
};
