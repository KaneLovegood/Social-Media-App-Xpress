# ChatContainer Refactoring Summary

## Mục đích
Giảm kích thước file ChatContainer từ 1600+ dòng xuống còn dưới 800 dòng bằng cách tách các logic trùng lặp và gom nhóm vào custom hooks.

## Thay đổi chính

### 1. **lib/chat-utils.ts** (Utilities chung)
Tất cả utility functions được chuyển sang file riêng:
- `getClearHistoryStorageKey()` - Tạo key storage
- `toPrivateRoomId()` - Tạo room ID từ 2 user ID
- `toAgeLabel()` - Format timestamp thành label thời gian
- `sortMessages()` - Sắp xếp tin nhắn theo thời gian
- `mergeMessages()` - Kết hợp tin nhắn cũ và mới
- `toMessagePreview()` - Tạo preview text cho tin nhắn

### 2. **hooks/useClearedHistory.ts**
Quản lý trạng thái lịch sử tin nhắn bị xóa:
- Load/save từ localStorage
- `markRoomCleared()` - Đánh dấu phòng đã xóa lịch sử
- Trả về: `clearedRoomAtById`, `isClearHistoryHydrated`

### 3. **hooks/useCallState.ts**
Gom 8 state liên quan call thành 1 hook:
- Private call: `callMode`, `callDirection`, `incomingCall`
- Group call: `groupCallRoomId`, `groupCallMode`, `groupCallDirection`, `pendingGroupCall`
- Helper: `resetPrivateCall()`, `resetGroupCall()`

### 4. **hooks/useMessageActions.ts**
Quản lý các action trên tin nhắn (copy, pin, mark, select, view details):
- Tất cả emit Custom Event
- Tập trung vào 1 chỗ dễ maintain

### 5. **hooks/useRoomManagement.ts**
Quản lý danh sách phòng chat và loading:
- `reloadRooms()` - Fetch danh sách phòng
- `ensureGroupDetails()` - Lazy-load thông tin group
- State: `rooms`, `activeRoomId`, `presenceByUser`, etc.

### 6. **hooks/useCallHandlers.ts**
Xử lý các action liên quan call:
- `openVoiceCall()`, `openVideoCall()` - Khởi tạo cuộc gọi
- `handleAcceptIncomingCall()`, `handleDeclineIncomingCall()` - Trả lời
- `handleAcceptGroupCall()`, `handleDeclineGroupCall()` - Group call

### 7. **hooks/useChatSocketHandlers.ts**
Tất cả socket event listeners (chiếm ~400 dòng):
- Message handlers: `onMessage`, `onGroupMessage`
- State update: `onRecalled`, `onReceived`, `onTyping`
- Group: `onGroupRoomUpdated`, `onGroupMemberLeft`, `onGroupDissolved`
- Call: `onGroupCallStarted`, `onGroupCallEnded`, `onIncomingCall`, `onCallEnd`
- Presence: `onPresence`

## File sau refactor

### ChatContainer.tsx
**Trước:** 1600+ dòng
**Sau:** ~750 dòng

Giữ lại:
- Props interface
- Main render + UI layout
- State initialization
- Handle send/recall/typing/delete
- Handle delete chat history
- Handle room selection
- Handle group operations (create, dissolve, leave)
- useChatSocketHandlers hook call

## Lợi ích

✅ **Dễ maintain** - Logic được tách rõ ràng, mỗi hook có 1 trách nhiệm
✅ **Reusable** - Có thể dùng `useCallState`, `useMessageActions` ở chỗ khác
✅ **Testable** - Custom hooks dễ unit test
✅ **Performance** - Không có logic thừa, dependencies rõ ràng
✅ **Readability** - ChatContainer trở thành chỉ UI composition

## Cách sử dụng

```tsx
import { useClearedHistory } from '@/hooks/useClearedHistory';
import { useCallState } from '@/hooks/useCallState';
import { useMessageActions } from '@/hooks/useMessageActions';
import { useChatSocketHandlers } from '@/hooks/useChatSocketHandlers';

// Trong component
const { clearedRoomAtById, markRoomCleared } = useClearedHistory(userId);
const { callMode, setCallMode, groupCallRoomId, ... } = useCallState();
const { handleCopyMessage, handlePinMessage, ... } = useMessageActions(roomId, peerId);

useChatSocketHandlers({
  socket,
  currentUserId,
  // ... rest props
});
```

## Notes

- Tất cả imports đã được update trong ChatContainer
- Không có breaking changes trong public API
- Socket handlers vẫn đầy đủ, chỉ di chuyển sang file khác
- Custom hooks follow React hooks best practices
