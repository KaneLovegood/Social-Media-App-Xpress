import { useCallback, useState, useMemo } from 'react';
import { ChatRoomSummary, fetchChatRooms } from '@/lib/chat-rooms';
import { GroupRoomDetails, fetchGroupRoomDetails } from '@/lib/chat-groups';
import { ChatMessage } from '@/lib/realtime/types';

export function useRoomManagement(
  currentUserId: string,
  initialRoomId?: string,
  initialPeerUserId?: string,
) {
  const [rooms, setRooms] = useState<ChatRoomSummary[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [activeRoomId, setActiveRoomId] = useState('');
  const [messagesByRoom, setMessagesByRoom] = useState<Record<string, ChatMessage[]>>({});
  const [loadedRoomIds, setLoadedRoomIds] = useState<Record<string, boolean>>({});
  const [groupDetailsByRoom, setGroupDetailsByRoom] = useState<Record<string, GroupRoomDetails>>({});
  const [presenceByUser, setPresenceByUser] = useState<Record<string, boolean>>({});

  const reloadRooms = useCallback(async () => {
    setIsLoadingRooms(true);
    try {
      const fetchedRooms = await fetchChatRooms();
      setRooms(fetchedRooms);
      setPresenceByUser(
        fetchedRooms.reduce<Record<string, boolean>>((acc, room) => {
          acc[room.peerUserId] = room.isPeerOnline;
          return acc;
        }, {}),
      );
    } finally {
      setIsLoadingRooms(false);
    }
  }, []);

  const ensureGroupDetails = useCallback(
    async (roomId: string) => {
      const existing = groupDetailsByRoom[roomId];
      if (existing) {
        return existing;
      }

      const details = await fetchGroupRoomDetails(roomId);
      setGroupDetailsByRoom((prev) => ({
        ...prev,
        [details.roomId]: details,
      }));
      return details;
    },
    [groupDetailsByRoom],
  );

  const handleSelectRoom = (roomId: string) => {
    setActiveRoomId(roomId);
  };

  return {
    rooms,
    setRooms,
    isLoadingRooms,
    activeRoomId,
    setActiveRoomId,
    messagesByRoom,
    setMessagesByRoom,
    loadedRoomIds,
    setLoadedRoomIds,
    groupDetailsByRoom,
    setGroupDetailsByRoom,
    presenceByUser,
    setPresenceByUser,
    reloadRooms,
    ensureGroupDetails,
    handleSelectRoom,
  };
}
