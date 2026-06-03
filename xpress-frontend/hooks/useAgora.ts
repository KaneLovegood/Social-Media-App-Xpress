import { useCallback, useEffect, useRef, useState } from 'react';
import AgoraRTC, {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  IAgoraRTCRemoteUser,
} from 'agora-rtc-sdk-ng';

export const useAgora = (client: IAgoraRTCClient | null) => {
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
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
    async (
      appId: string,
      channel: string,
      token: string,
      uid?: string | number | null,
      withVideo = true,
    ) => {
      if (!client || isJoining.current) return;

      isJoining.current = true;
      try {
        await client.join(appId, channel, token, uid);

        let audioTrack: IMicrophoneAudioTrack | null = null;
        let videoTrack: ICameraVideoTrack | null = null;

        try {
          if (withVideo) {
            const [aTrack, vTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
            audioTrack = aTrack;
            videoTrack = vTrack;
          } else {
            audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          }
        } catch (mediaErr) {
          if (withVideo) {
            console.warn('Failed to create both Microphone and Camera tracks. Attempting microphone only...', mediaErr);
            try {
              audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
            } catch (audioErr) {
              console.error('Failed to create Microphone track as well. Recording devices may be blocked or unavailable:', audioErr);
              throw mediaErr;
            }
          } else {
            throw mediaErr;
          }
        }

        if (!isJoining.current) {
          if (audioTrack) {
            audioTrack.stop();
            audioTrack.close();
          }
          if (videoTrack) {
            videoTrack.stop();
            videoTrack.close();
          }
          await client.leave();
          return;
        }

        tracksRef.current = { audio: audioTrack, video: videoTrack };
        setLocalAudioTrack(audioTrack);
        setLocalVideoTrack(videoTrack);

        const tracksToPublish = [];
        if (audioTrack) tracksToPublish.push(audioTrack);
        if (videoTrack) tracksToPublish.push(videoTrack);

        if (tracksToPublish.length > 0) {
          await client.publish(tracksToPublish);
        }
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

    const handleUserPublished = async (
      user: IAgoraRTCRemoteUser,
      mediaType: 'audio' | 'video',
    ) => {
      await client.subscribe(user, mediaType);
      setRemoteUsers((prevUsers) => {
        const existing = prevUsers.find((u) => u.uid === user.uid);
        if (existing) {
          return prevUsers.map((u) => (u.uid === user.uid ? user : u));
        }
        return [...prevUsers, user];
      });
    };

    const handleUserUnpublished = (user: IAgoraRTCRemoteUser) => {
      setRemoteUsers((prevUsers) => prevUsers.filter((u) => u.uid !== user.uid));
    };

    const handleUserJoined = (user: IAgoraRTCRemoteUser) => {
      setRemoteUsers((prevUsers) => {
        if (prevUsers.find((u) => u.uid === user.uid)) return prevUsers;
        return [...prevUsers, user];
      });
    };

    const handleUserLeft = (user: IAgoraRTCRemoteUser) => {
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
