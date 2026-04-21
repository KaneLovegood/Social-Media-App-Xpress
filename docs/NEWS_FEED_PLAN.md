# 📌 README – Functional Requirements: News Feed
---
## 1. 🎯 Mục tiêu

Xây dựng chức năng **News Feed** trong hệ thống chat (tương tự Zalo) cho phép người dùng xem, tương tác và quản lý nội dung được chia sẻ từ bạn bè hoặc nhóm.

---

## 2. 👥 Actors

* **User (Người dùng)**
* **System (Hệ thống)**

---

## 3. 🧩 Tổng quan chức năng

News Feed là nơi hiển thị các bài đăng (post) theo thời gian thực hoặc gần thời gian thực, bao gồm:

* Bài viết cá nhân
* Bài viết từ bạn bè
* Bài viết trong nhóm

---



## 4. 📋 Functional Requirements

### 4.1. Xem News Feed

* Người dùng có thể xem danh sách bài viết:

  * Sắp xếp theo thời gian (mới nhất trước)
  * Có thể hỗ trợ thuật toán ranking (optional)
* Mỗi bài viết hiển thị:

  * Avatar + tên người đăng
  * Nội dung (text, image, video)
  * Thời gian đăng
  * Số lượt like, comment

---

### 4.2. Tạo bài viết (Create Post)

* Người dùng có thể:

  * Đăng bài với text
  * Upload hình ảnh / video
* Hệ thống cần:

  * Validate nội dung
  * Lưu trữ media (S3 / CDN)
  * Tạo post record

---

### 4.3. Tương tác bài viết

#### a. Like / Reaction

* Người dùng có thể:

  * Like / Unlike bài viết
* Hệ thống:

  * Cập nhật số lượng like
  * Tránh duplicate like

#### b. Comment

* Người dùng có thể:

  * Thêm comment
  * Xóa comment của mình
* Hệ thống:

  * Lưu thread comment
  * Có thể hỗ trợ nested comment (optional)

---

### 4.4. Chia sẻ bài viết (Share)

* Người dùng có thể share bài viết:

  * Lên feed cá nhân
  * Gửi qua chat
* Hệ thống:

  * Tạo reference đến post gốc

---

### 4.5. Xóa / chỉnh sửa bài viết

* Người dùng có thể:

  * Xóa bài viết của mình
  * Chỉnh sửa nội dung (text)
* Hệ thống:

  * Kiểm tra quyền (owner)
  * Soft delete hoặc hard delete

---

### 4.6. Load dữ liệu (Pagination / Infinite Scroll)

* Hỗ trợ:

  * Infinite scroll
  * Cursor-based pagination (khuyến nghị)
* Giảm tải:

  * Lazy loading media

---

### 4.7. Realtime update

* Khi có:

  * Bài viết mới
  * Like / comment mới
* Hệ thống:

  * Push qua WebSocket / SSE

---

## 5. ⚙️ Non-functional Requirements (gợi ý cho AI code)

### 5.1. Performance

* Feed load < 2s
* Cache feed (Redis)

### 5.2. Scalability

* Sử dụng:

  * Feed fan-out (push model) hoặc pull model
* Có thể dùng queue (Kafka / RabbitMQ)

### 5.3. Consistency

* Eventually consistent cho feed
* Strong consistency cho action (like/comment)

---

## 6. 🗂️ Data Model (gợi ý)

### Post

```
{
  id: string,
  userId: string,
  content: string,
  mediaUrls: string[],
  createdAt: datetime,
  updatedAt: datetime,
  visibility: "public" | "friends" | "private"
}
```

### Like

```
{
  userId: string,
  postId: string,
  createdAt: datetime
}
```

### Comment

```
{
  id: string,
  userId: string,
  postId: string,
  content: string,
  parentId: string | null,
  createdAt: datetime
}
```

---

## 7. 🔌 API Design (gợi ý)

### Feed

* `GET /feed`
* `GET /feed?cursor=...`

### Post

* `POST /posts`
* `PUT /posts/:id`
* `DELETE /posts/:id`

### Like

* `POST /posts/:id/like`
* `DELETE /posts/:id/like`

### Comment

* `POST /posts/:id/comments`
* `DELETE /comments/:id`

---

## 8. 🚀 Gợi ý kiến trúc cho AI generate code

* Backend: Node.js (Express / NestJS)
* Database: MongoDB / PostgreSQL
* Cache: Redis
* Realtime: WebSocket (Socket.IO)
* Storage: AWS S3

---

## 9. 🧠 Prompt gợi ý để đưa vào AI code generator

```
Build a scalable News Feed system similar to Zalo with the following features:
- Users can create posts with text, images, videos
- Users can like, comment, and share posts
- Feed should support pagination and real-time updates
- Use Node.js + Express, MongoDB, Redis, and WebSocket
- Implement clean architecture and modular design
- Include API, models, services, and controllers
```

---

## 10. 📌 Ghi chú

* Có thể mở rộng:

  * Story (tin 24h)
  * Reaction nâng cao (haha, love,...)
  * AI recommendation feed

---