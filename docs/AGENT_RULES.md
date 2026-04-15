# 🧠 Project Rules – Realtime Chat (NestJS + Socket.IO + WebRTC)

## 1. General Principles
- Use clean architecture (module → service → gateway)
- Follow NestJS best practices
- Code must be modular, scalable, reusable
- Avoid hardcoding values
- Use TypeScript strictly

---

## 2. Backend (NestJS + Socket.IO)

### 2.1 Gateway Rules
- Use @nestjs/websockets with Socket.IO
- All realtime logic MUST go through Gateway
- Do NOT put business logic inside Gateway → move to Service
- Use events naming convention:
chat:send
chat:reply
chat:delete
chat:recall
chat:typing
call:offer
call:answer
call:ice
call:end

---

### 2.2 Authentication
- Assume JWT auth already exists
- Extract userId from socket:
client.data.userId
- Reject unauthenticated socket

---

### 2.3 Message Rules

#### Message Types:
- text
- reply

#### Required fields:
- id
- senderId
- receiverId
- content
- createdAt
- updatedAt
- isDeleted
- isRecalled
- replyToMessageId (optional)

---

### 2.4 Business Logic

#### Send Message
- Save message
- Emit to receiver

#### Reply Message
- Link with `replyToMessageId`
- Include original message preview

#### Delete Message
- Soft delete (isDeleted = true)
- Only sender can delete

#### Recall Message
- Only within 24 hours
- Replace content with: "Message recalled"
- Mark isRecalled = true

---

### 2.5 WebRTC Signaling (IMPORTANT)
- Backend ONLY handles signaling
- DO NOT process media

Events:
- call:offer
- call:answer
- call:ice
- call:end

---

## 3. Frontend (React or Next.js)

### 3.1 Component Structure

#### Reusable Chat Component
- Must support:
  - 1-1 chat
  - group chat (future-ready)
- Props:
  - messages
  - currentUser
  - onSend
  - onReply
  - onDelete
  - onRecall

---

### 3.2 Required Components

- ChatContainer (logic)
- MessageList
- MessageItem
- MessageInput
- ReplyPreview
- TypingIndicator

---

### 3.3 Call UI Component (1-1 ONLY)

- VideoCallComponent
  - local video
  - remote video
  - mute/unmute
  - end call
  - camera toggle

---

### 3.4 State Management
- Use socket events
- Optimistic UI for sending message

---

## 4. Code Quality
- Use DTO + validation
- Use enums for event names
- Use constants for magic strings
- Add comments for complex logic

---

## 5. Deliverables
Agent MUST generate:
- Gateway
- Service
- DTO
- Event constants
- Frontend components
- Example socket flow

architecture
[ Client A ]                        [ Client B ]
     │                                   │
     │   (Socket.IO events)              │
     ├──────────────┬────────────────────┤
                    │
             [ ChatGateway ]
                    │
             [ ChatService ]
                    │
                [ Database ]

2. FLOW CHAT REALTIME
2.1 Send Message
Client A
   │
   │ emit: chat:send
   ▼
ChatGateway
   │
   │ → validate userId
   ▼
ChatService
   │
   │ → save message DB
   ▼
ChatGateway
   │
   │ emit → Client B (chat:receive)
   ▼
Client B

👉 Chi tiết:

A gửi message → server lưu DB → push realtime cho B
Có thể thêm:
emit lại cho A để sync UI
2.2 Reply Message
Client A
   │
   │ emit: chat:reply (replyToMessageId)
   ▼
ChatService
   │
   │ → find original message
   │ → attach preview
   │ → save new message
   ▼
ChatGateway
   │
   │ emit → Client B

👉 Message lúc này có:

{
  content: "ok",
  replyTo: {
    id: "...",
    content: "original message"
  }
}
2.3 Delete Message
Client A
   │
   │ emit: chat:delete
   ▼
ChatService
   │
   │ → check sender
   │ → set isDeleted = true
   ▼
ChatGateway
   │
   │ emit update → Client B

👉 UI:

show: "Message deleted"
2.4 Recall Message (24h)
Client A
   │
   │ emit: chat:recall
   ▼
ChatService
   │
   │ → check time <= 24h
   │ → update message:
   │    content = "Message recalled"
   │    isRecalled = true
   ▼
ChatGateway
   │
   │ emit update → Client B
2.5 Typing Indicator (optional nhưng nên có)
Client A
   │
   │ emit: chat:typing
   ▼
ChatGateway
   │
   │ emit → Client B
   ▼
Client B (show "typing...")


3. FLOW WEBRTC CALL (QUAN TRỌNG NHẤT)

👉 Backend KHÔNG xử lý media
👉 Chỉ làm signaling server

3.1 Call Flow Tổng thể
Client A                Server                Client B
   │                      │                      │
   │ --- call:offer ----> │ ---- offer -------> │
   │                      │                      │
   │ <--- call:answer --- │ <--- answer ------- │
   │                      │                      │
   │ --- call:ice ------> │ ---- ice ---------> │
   │ <--- call:ice ------ │ <--- ice ---------- │
   │                      │                      │
   │ ====== CONNECTED (P2P) ======              │
3.2 Step-by-step WebRTC
🟢 STEP 1: Create Offer
Client A:
- create RTCPeerConnection
- createOffer()
- setLocalDescription()

emit → call:offer
🟢 STEP 2: Server forward
ChatGateway:
- nhận offer
- emit → Client B
🟢 STEP 3: Answer
Client B:
- setRemoteDescription(offer)
- createAnswer()
- setLocalDescription()

emit → call:answer
🟢 STEP 4: ICE Candidate
Cả 2 phía:
- onicecandidate → emit call:ice
- nhận → addIceCandidate()
🟢 STEP 5: Connected
Video stream chạy P2P (không qua server)
🟢 STEP 6: End Call
emit: call:end
→ close connection

4. SOCKET EVENT DESIGN (chuẩn cho bạn dùng)
// CHAT
chat:send
chat:reply
chat:delete
chat:recall
chat:typing

// CALL
call:offer
call:answer
call:ice
call:end
🧱 5. CẤU TRÚC BACKEND (gợi ý chuẩn)
chat/
 ├── chat.gateway.ts
 ├── chat.service.ts
 ├── dto/
 │    ├── send-message.dto.ts
 │    ├── reply-message.dto.ts
 │    ├── delete-message.dto.ts
 │    ├── recall-message.dto.ts
 ├── interfaces/
 ├── constants/
 │    ├── events.ts

 6. TIPS QUAN TRỌNG (đọc kỹ)
⚠️ 1. Mapping user ↔ socket

Bạn PHẢI có:

userId → socketId

→ để emit đúng người

2. Tránh bug phổ biến WebRTC
quên setLocalDescription ❌
không handle ICE ❌
emit sai user ❌