# Tài liệu Phân tích và Triển khai tính năng Social & Group Chat cho MCP

## 1. Phân tích vấn đề hiện tại
Hệ thống MCP (Model Context Protocol) đã được tích hợp thành công cho các nghiệp vụ Logistics (RAG, tra cứu dữ liệu). Tuy nhiên, AI Assistant vẫn còn các hạn chế trong tương tác xã hội và nhóm:
- **Thiếu kết nối xã hội & Nhóm**: AI không thể tìm kiếm người dùng, quản lý danh bạ bạn bè trực tiếp, hoặc tạo phòng chat nhóm.
- **Quy trình rời rạc**: Người dùng phải tìm kiếm email thủ công, nhấn nút kết bạn, hoặc tạo nhóm trên UI thay vì yêu cầu AI thực hiện tự nhiên qua tin nhắn.
- **Context bị phân mảnh**: Khi người dùng hỏi về một người cụ thể, AI không có công cụ để định danh (`userId`) và kiểm tra trạng thái quan hệ (FRIEND, PENDING, NONE), dẫn đến sự gián đoạn trong việc thực thi chuỗi hành động như "Tìm X và thêm vào nhóm".
- **Hạn chế dữ liệu Group**: Backend hỗ trợ Group Chat rất mạnh mẽ qua DynamoDB, nhưng MCP Server chưa được cấp quyền thao tác trên các bản ghi `CHAT_GROUP_ROOM` và `CHAT_GROUP_MEMBER`.

## 2. Giải thích đúng yêu cầu
Mục tiêu là tích hợp các APIs Social và Group của backend vào bộ công cụ MCP để AI có thể thực hiện liên hoàn:

**Về Social (Bạn bè gốc):**
1. **Tìm kiếm người dùng qua Email**: Trả về `userId`, `name`, và `friendStatus`.
2. **Kiểm tra trạng thái bạn bè**: Biết được mối quan hệ hiện tại để đưa ra phản hồi hoặc quyết định bước tiếp theo.
3. **Tự động thực hiện hành động**: Gửi lời mời kết bạn (`sendFriendRequest`) nếu chưa là bạn, nhận/từ chối lời mời.

**Về Group Chat (Nhóm):**
1. **Tạo nhóm chat mới**: AI tự động tạo `roomId`, `inviteCode`, thiết lập người yêu cầu làm ADMIN. AI phải biết tự hỏi tên nhóm nếu người dùng không cung cấp.
2. **Thêm thành viên vào nhóm**: Đưa người khác (qua `userId` thu được từ tìm kiếm) vào nhóm chỉ định.
3. **Tương tác thông minh (Chuỗi hành động)**: Ví dụ "Tạo nhóm và thêm X": AI hỏi tên nhóm -> Tìm email X lấy `userId` -> Tạo nhóm -> Thêm X vào nhóm.

**Về Phản hồi người dùng:**
1. AI phải xác nhận rõ ràng kết quả sau mỗi hành động quan trọng (tạo nhóm xong, thêm người xong, kết bạn thành công).
2. Thông báo cho người dùng biết nếu đang cần thêm thông tin đầu vào (ví dụ: email thiếu, tên nhóm chưa có).

## 3. Phương án giải quyết
Mở rộng **MCP Server** hiện tại bằng cách thêm bộ công cụ `social_*` và thao tác trực tiếp với dữ liệu chuẩn.

### Kiến trúc & Kỹ thuật:
- **MCP Tools**: Đăng ký các công cụ mới trong `logistics-mcp-server`.
- **Dữ liệu**: Truy cập trực tiếp vào DynamoDB (dùng chung định dạng `PK`/`SK` với backend) để đảm bảo đồng bộ.
  - Sử dụng `TransactWriteCommand` của AWS SDK cho các thao tác đa bản ghi như tạo Nhóm (vừa lưu room, vừa tạo member) nhằm đảm bảo toàn vẹn dữ liệu.
- **Luồng Context**: AI sử dụng dữ liệu đầu ra của tool (như `userId`, `roomId`) làm `input` cho các tool tiếp nối trong cùng một chuỗi hội thoại.

## 4. Đề xuất ưu tiên triển khai
1. **Ưu tiên 1 (Core Social & Group)**: 
   - `social_search_user`: Tìm kiếm người dùng qua email / Lấy trạng thái bạn bè.
   - `social_send_request`: Gửi lời mời kết bạn.
   - `social_create_group`: Tạo phòng chat nhóm.
2. **Ưu tiên 2 (Advanced Group & Management)**:
   - `social_add_to_group`: Thêm thành viên vào nhóm.
   - `social_list_friends`: Lấy danh sách bạn bè hiện tại.
   - `social_accept_reject_friend`: Xử lý yêu cầu kết bạn.
   - `social_list_my_groups`: Trả về các nhóm mà user đang tham gia.

## 5. Các file cần thay đổi

### Logistics MCP Server:
- `logistics-mcp-server/src/services/social.service.ts`: Viết logic DynamoDB cho `listFriends`, `handleFriendRequest`, `createGroup`, `addMemberToGroup`, `listMyGroups`.
- `logistics-mcp-server/src/index.ts`: Đăng ký các công cụ giao tiếp như `social_search_user`, `social_send_friend_request`, `social_create_group`, `social_add_to_group`, v.v...

### Xpress Backend:
- `xpress-backend/src/modules/mcp/services/mcp.service.ts`: Cập nhật `systemPrompt` để hướng dẫn AI quy trình sử dụng các tool Social và Group (Cách tra cứu -> Tạo nhóm -> Mời vào nhóm...).

## 6. Cách triển khai cụ thể

### Bước 1: Mở rộng SocialService (MCP)
Cài đặt tuần tự các hàm thao tác DynamoDB:
```typescript
// Social
async listFriends(userId: string) {
  // Query PK=USER#userId, SK begins_with FRIEND#
}
async handleFriendRequest(actorUserId: string, targetUserId: string, action: 'ACCEPT' | 'REJECT') {
  // Nếu ACCEPT: Cập nhật status 2 bản ghi thành 'FRIEND'
  // Nếu REJECT: Xóa cả 2 bản ghi FRIEND
}

// Group Chat
async createGroup(title: string, actorUserId: string) {
  // 1. Tạo roomId (uuid) và inviteCode
  // 2. TransactWrite: Put META (ROOM#roomId) và Put MEMBER (MEMBER#actorUserId - set ADMIN)
}
async addMemberToGroup(roomId: string, targetUserId: string, actorUserId: string) {
  // 1. Kiểm tra actorUserId có quyền ADMIN/MEMBER tùy logic
  // 2. TransactWrite: Put MEMBER mới và Update META (tăng memberCount)
}
```

### Bước 2: Đăng ký Tool trong MCP Server
Thêm các block đăng ký tool trong `index.ts`, ví dụ:
```typescript
server.tool(
  "social_search_user",
  "Tìm kiếm người dùng theo email và xem trạng thái bạn bè.",
  { email: z.string().email() },
  async ({ email }) => { ... } // Scan email -> GetItem lấy quan hệ
);

server.tool(
  "social_create_group",
  "Tạo nhóm chat mới.",
  { title: z.string().description("Tên nhóm chat") },
  async ({ title }, { req }) => { ... } // Gọi createGroup
);

server.tool(
  "social_add_to_group",
  "Thêm người dùng vào nhóm chat.",
  { roomId: z.string(), targetUserId: z.string() },
  async ({ roomId, targetUserId }, { req }) => { ... }
);
```

### Bước 3: Cập nhật Backend System Prompt
Cập nhật `systemPrompt` cho AI Assistant trong backend:
*"Nếu người dùng muốn tìm người hoặc kết bạn, dùng các tool `social_*`. Luôn tìm kiếm email để lấy `userId` trước. Nếu người dùng muốn tạo nhóm, dùng `social_create_group` (hỏi tên nhóm nếu người dùng chưa cung cấp). Sau đó, nếu cần thêm người, dùng `social_add_to_group` với `roomId` vừa nhận được và `userId` của người muốn thêm."*

### Bước 4: Kiểm thử (Verification)
- **Kịch bản 1 (Social)**: "Tìm người có email X" -> Trả kết quả NONE. "Hãy gửi lời mời kết bạn" -> AI truyền được đúng targetUserId.
- **Kịch bản 2 (Group)**: "Tạo giúp tôi 1 nhóm để bàn việc" -> AI hỏi: "Vui lòng cho mình biết tên nhóm". -> Người dùng báo "Dự án mới" -> Nhóm được tạo thành công, AI báo OK và cung cấp invite code (nếu có).
- **Kịch bản 3 (Chuỗi kết hợp)**: "Tạo nhóm Dự Án X và thêm người có email Y vào nhóm luôn nhé." -> AI tự bóc tách, tra Y lấy ID, tạo nhóm Dự Án X lấy roomId, sau đó add Y vào nhóm.
