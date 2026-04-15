# Tài liệu mô tả Module Chat (Chat Module Flow)

🔗 **Liên kết liên quan (Dependencies):**
- Tính năng đính kèm Ảnh/File: [[CHAT_FILE_UPLOAD_FEATURE.md]]

Module Chat trong dự án `xpress-backend` đảm nhiệm toàn bộ tính năng liên quan đến trò chuyện trực tuyến và gọi thoại/video giữa các người dùng. Module này tận dụng cả **REST API** (để lấy dữ liệu lịch sử) và **WebSocket** (để truyền tải dữ liệu thời gian thực và tín hiệu WebRTC).

## 1. Thành phần và Vai trò (Component Architecture)

- **`ChatController` (`chat.controller.ts`)**: Cung cấp REST APIs cho:
  - Lấy danh sách phòng chat, lịch sử tin nhắn phòng/nhóm.
  - Quản lý Group Chat (Tạo nhóm, Thêm/xóa thành viên, Giải tán nhóm, Cấp quyền).
  - Khởi tạo các tín hiệu (actions) điều khiển cuộc gọi thoại/video.
- **`ChatGateway` (`chat.gateway.ts`)**: Quản lý kết nối WebSocket (thông qua `Socket.io` trên namespace `/chat`). Chịu trách nhiệm xác thực socket, duy trì trạng thái online/offline, và lắng nghe/phát sự kiện thời gian thực (nhắn tin cá nhân, nhắn tin nhóm, gõ phím, gọi điện nhóm/cá nhân).
- **`ChatService` (`chat.service.ts`)**: Cốt lõi logic của Chat:
  - Xử lý gửi/xóa/thu hồi/trả lời tin nhắn (Cả 1-1 và Group).
  - Quản lý trạng thái presence (thông qua `PresenceService`).
  - Quản lý phòng chat nhóm (Room/Member manipulation).
  - Quản lý Memory Call Sessions (các phiên gọi điện) và Call Signaling định tuyến.
  - Tích hợp với `SocialService` đảm bảo an toàn/chặn (Block).
- **`MessagesRepository` & `GroupRoomsRepository`**: Quản lý thao tác trực tiếp với **DynamoDB** để cấu trúc tin nhắn (`MessageEntity`) và phòng chat nhóm (`GroupRoomEntity`, `GroupMemberEntity`) thông qua các khoá PK/SK, GSI Index.

---

## 2. Các tính năng hiện có (Current Features)

### A. Quản lý Tin nhắn & Group Chat (Messaging & Groups)
1. **Chat 1-1 (Private Chat)**: Gửi tin nhắn, trả lời (Reply), thu hồi (Recall), và xóa mềm (Soft Delete) tới một người cụ thể.
2. **Chat Nhóm (Group Chat)**:
   - Tạo nhóm mới, đặt tên, ảnh đại diện, emoji (`POST /chat/groups`).
   - Gửi tin nhắn vào nhóm (sử dụng `chat:group_send` trên Socket hoặc API REST).
   - Thêm thành viên, xóa thành viên, tự động rời nhóm, giải tán nhóm (nếu là Admin).
   - Thay đổi vai trò (Promote/Demote admin).
3. **Lịch sử trò chuyện**: 
   - Lấy danh sách tất cả loại phòng (`GET /chat/rooms`: bao gồm Private & Group).
   - Lấy lịch sử và thông tin chi tiết một nhóm (Thành viên nhóm, ảnh đại diện, số lượng chưa đọc).

### B. Trạng thái hiển thị theo thời gian thực (Real-time Indicators)
1. **Trạng thái Online/Offline**: Socket gửi broadcast `chat:presence`.
2. **WebSockets Channels (Rooms)**: Mỗi user kết nối sẽ tham gia vào sub-room `user:<userId>` và được tự động join vào tất cả các `room:<groupId>` mà user đó đang là member.
3. **Gỡ bỏ/Thêm User Live**: Khi Admin kích một người khỏi nhóm, Gateway báo `chat:group_member_left` để client đuổi user ra khỏi phòng trên giao diện.

### C. Voice & Video Call (Bao gồm Group Call)
Sử dụng Signaling WebRTC p2p giữa các client:
1. **Chat 1-1 Call**: Định tuyến Offer/Answer/ICE bằng gateway dựa trên Socket ID (REST `open_voice_call` -> Socket `call:*`). Lưu CallSummary khi tắt.
2. **Group Call**: Cung cấp Event Signaling riêng cho tính năng gọi trong nhóm (Các event Socket `chat:group_call_start`, `chat:group_call_signal`, `chat:group_call_end`). Hỗ trợ người dùng trong nhóm gọi cho nhau.

---

## 3. Luồng Hoạt Động Cụ Thể (Workflow)

### Luồng 1: Tham gia và khởi tạo Socket
1. Gateway (`ChatGateway`) xác thực JWT -> cấp quyền Socket.
2. Gateway tự động gọi hàm để lấy danh sách Group IDs của User đó.
3. Sau đó bắt buộc client join vào socket channel cá nhân (`user:123`) và socket channel của các Groups (VD: `group:456`, `group:789`).
4. Ghi danh Presence Online phát broadcast cho những người liên quan.

### Luồng 2: Nhắn tin Nhóm (Group Messaging Flow)
1. User gửi socket event `chat:group_send` thay vì `chat:send` (Kèm `roomId` và `content`).
2. `ChatService.sendGroupMessage()` cấp phát `messageId`, lưu xuống DynamoDB là `roomType: GROUP` và `roomId: ...`.
3. Save xong DB, phát socket qua lệnh: `this.emitToGroup(roomId, CHAT_EVENTS.GROUP_MESSAGE, message)`. Tất cả ai join channel `group:<roomId>` đều nhận được.

### Luồng 3: WebRTC Group Call Signaling Flow 
Khác với chat 1-1, gọi nhóm phức tạp hơn một chút:
1. Một người khởi xướng: Bắn `chat:group_call_start` gửi cùng `roomId` và `callMode`.
2. Gateway broadcast lời mời gọi đến tất cả user trong channel Room đó.
3. Người kia muốn Join sẽ bắt đầu tạo `PeerConnection`, rồi gửi các SDP/ICE thông qua `chat:group_call_signal`, trong đó chỉ rõ `receiverId` là ai.
4. Gateway định tuyến tín hiệu WebRTC này đi chính xác về phía receiver kia để đàm phán hình ảnh/âm thanh mà không cần thông qua Backend media server, tức chia lưới Mesh.

