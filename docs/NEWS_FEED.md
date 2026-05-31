Realtime Chat System - News Feed Feature Specification
Tài liệu này mô tả chi tiết các yêu cầu chức năng (Functional Requirements), luồng nghiệp vụ (Workflows), giao diện (UI/UX) và giải pháp kỹ thuật thời gian thực (Realtime Architecture) cho Chức năng Bảng tin (News Feed).

1. Tổng Quan Chức Năng (Overview)
   Chức năng News Feed cho phép người dùng đăng tải nội dung cá nhân, cập nhật trạng thái và tương tác với các bài viết của bạn bè trong danh sách.

Mục tiêu cốt lõi: Nội dung mới, lượt tương tác (Like, Comment) phải được cập nhật thời gian thực (realtime) tới các user đang online một cách mượt mà.

Cơ chế phân phối tin: Áp dụng mô hình kết hợp giữa Fan-out-on-write (đối với user thông thường) hoặc Fan-out-on-read để tối ưu tốc độ tải tin. 2. Mô Tả Luồng Nghiệp Vụ Chi Tiết (Use Cases & Workflows)
2.1. Đăng bài viết mới (Create Post)
Thành phần bài đăng: Văn bản (Text), Hình ảnh (tối đa 9 ảnh), Video ngắn (dưới 60s), Emoji.

Cài đặt quyền riêng tư (Privacy Settings):

Công khai (Public): Ai cũng có thể thấy.

Bạn bè (Friends): Chỉ những người có trạng thái quan hệ là ACCEPTED mới thấy.

Chỉ mình tôi (Private): Chỉ người đăng thấy.

Luồng xử lý Realtime:

Khi User A bấm "Đăng", bài viết được lưu vào cơ sở dữ liệu.

Server xác định danh sách bạn bè đang online của User A.

Hệ thống phát một Socket Event (feed:new_post) chứa thông tin bài viết đến các thiết bị của bạn bè đang trực tuyến.

Tại Client của bạn bè: Bài viết mới tự động xuất hiện ở đầu Bảng tin kèm hiệu ứng chuyển động mượt mà (Fade-in) mà không cần kéo để tải lại (Pull-to-refresh).
2.2. Tương tác bài viết (Post Reactions - Like/Heart/Haha)
Mô tả: Người dùng bày tỏ cảm xúc với bài viết của bạn bè.

Yêu cầu Realtime:

Khi User B nhấn "Like" bài viết của User A:

Tại Client của tất cả những ai đang xem bài viết đó: Số lượng Like tự động tăng lên, và avatar của User B hiển thị trong danh sách người đã tương tác mà không cần reload.

Tại Client của User A (Tác giả): Nhận được thông báo push-up/badge thông báo thời gian thực: "User B đã thích bài viết của bạn".

Nếu User B nhấn "Un-like", hệ thống giảm số lượng và cập nhật lại giao diện realtime tương tự.
2.3. Bình luận bài viết (Comments System)
Yêu cầu nghiệp vụ:

Hỗ trợ bình luận bằng Text, Emoji và tag tên bạn bè (@Username).

Hỗ trợ bình luận lồng nhau 2 cấp (Threaded Comments - Phản hồi một bình luận khác).

Luồng xử lý Realtime:

Khi một bình luận mới được gửi, hệ thống phát sự kiện comment:created.

Khung bình luận của bài viết đó trên màn hình của mọi người dùng đang xem sẽ tự động hiển thị bình luận mới ngay lập tức.

Lazy Loading cho Comment: Đối với các bài viết có trên 10 bình luận, hệ thống chỉ load trước 5 bình luận mới nhất, người dùng bấm "Xem thêm bình luận" để tải tiếp (phân trang).
2.4. Xóa và Chỉnh sửa bài viết (Delete & Edit Post)
Chỉnh sửa (Edit): Cho phép sửa nội dung chữ và quyền riêng tư. Khi lưu thành công, nội dung bài viết trên News Feed của bạn bè sẽ tự động cập nhật lại thông qua sự kiện feed:post_updated.

Xóa (Delete): Khi tác giả xóa bài viết, hệ thống phát sự kiện feed:post_deleted. Ngay lập tức, bài viết đó biến mất (Slide-up và ẩn) khỏi Bảng tin của tất cả bạn bè theo thời gian thực.

Thành phần UI Tính năng & Trải nghiệm Tương tác Realtime
Khung tạo bài viết Nằm ở trên cùng, có nút bấm nhanh để mở kho ảnh/video, chọn quyền riêng tư. Hiển thị thanh tiến trình (Progress Bar) khi đang upload media.
Danh sách dòng thời gian Hiển thị các bài viết theo thứ tự thời gian từ mới nhất đến cũ nhất (Chronological Order). Tự động chèn bài viết mới lên đầu khi nhận được socket event từ Server.
Khung tương tác (Card chân trang) Chứa các nút: Like (kèm popover chọn emoji), Bình luận, Chia sẻ. Số lượng Like và Số lượng Comment nhảy số tự động (Counter Animation) khi có biến động.
Thông báo bài viết mới Khi người dùng đang cuộn xuống dưới mà có bài viết mới ở trên đầu, hiển thị một nút bong bóng: "Có bài viết mới ↑". Click vào nút này sẽ tự động cuộn mượt (Smooth Scroll) lên đầu trang và hiển thị bài viết mới.

4.3. Tối ưu Hiệu Năng & Giới Hạn (Performance & Guardrails)
Pagination (Infinite Scroll): Không load tất cả bài viết một lúc. Sử dụng con trỏ (Cursor-based Pagination) thay vì Offset để tránh trùng lặp bài viết khi có bài mới chèn vào đầu trang realtime.

Media Optimization: Hình ảnh tải lên News Feed phải được Server tự động nén (Compress) và phân tách thành nhiều độ phân giải (Thumbnail, Medium, Full) qua CDN để tối ưu dung lượng tải của Client.

Throttling/Debouncing cho Reaction: Tránh việc người dùng cố tình "Spam click" nút Like liên tục làm nghẽn kết nối Socket. Client phải thực hiện throttle (chỉ gửi request cuối cùng sau mỗi 300ms).
