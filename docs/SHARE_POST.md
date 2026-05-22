Realtime Chat System - Share Post Feature Specification
Tài liệu này mô tả các yêu cầu chức năng, luồng xử lý thời gian thực và trải nghiệm người dùng đối với tính năng Chia sẻ bài viết.

1. Tổng Quan Chức Năng (Overview)
   Chức năng Chia sẻ cho phép người dùng lan tỏa nội dung từ Bảng tin (News Feed) đến hai kênh chính:

Chia sẻ lên Dòng thời gian cá nhân (Share to Timeline): Tạo một bài viết mới trên News Feed của mình, dẫn nguồn từ bài viết gốc.

Chia sẻ qua Tin nhắn (Share via Chat/Direct Message): Gửi bài viết dưới dạng một thẻ tin nhắn (Message Card) vào phòng chat đôi hoặc chat nhóm. 2. Mô Tả Luồng Nghiệp Vụ Chi Tiết (Use Cases & Workflows)
2.1. Ràng buộc về Quyền riêng tư trước khi Chia sẻ (Privacy Validations)
Hệ thống phải kiểm tra quyền riêng tư của bài viết gốc (Original Post) trước khi hiển thị nút chia sẻ:

Bài viết Công khai (Public): Bất kỳ ai cũng có thể chia sẻ lên dòng thời gian hoặc gửi qua tin nhắn.

Bài viết chế độ Bạn bè (Friends Only):

Chỉ những người là bạn bè của tác giả gốc mới nhìn thấy nút "Chia sẻ".

Chỉ cho phép chia sẻ qua Tin nhắn chat cho người khác (nếu người nhận cũng là bạn của tác giả) hoặc chia sẻ lên tường nhà mình nhưng giữ nguyên cấu hình hiển thị là "Bạn bè".

Bài viết Chỉ mình tôi (Private): Ẩn hoàn toàn nút "Chia sẻ".

2.2. Chia sẻ lên Dòng thời gian (Share to Timeline)
Mô tả: Người dùng viết thêm cảm nghĩ và đính kèm bài viết gốc lên tường nhà mình.

Yêu cầu nghiệp vụ:

Bài viết chia sẻ (Shared Post) sẽ bao gồm: Nội dung cảm nghĩ mới (văn bản/emoji) + Khung hiển thị bài viết gốc (Avatar, tên tác giả gốc, nội dung chữ, media gốc).

Hệ thống cho phép chia sẻ lồng tối đa 2 cấp (Không cho phép chia sẻ một bài viết đã được chia sẻ từ một bài viết khác nữa để tránh loãng giao diện - Nested Share Limit).

Luồng xử lý Realtime:

Khi User B bấm "Chia sẻ lên tường" bài viết của User A.

Tăng số lượng chia sẻ (Realtime Counter): Tất cả người dùng đang xem bài viết gốc của User A trên News Feed sẽ thấy số lượng Lượt chia sẻ (Share Count) tự động nhảy tăng +1.

Đẩy tin realtime: Bài viết mới của User B lập tức xuất hiện trên đầu Bảng tin của danh sách bạn bè của User B thông qua Socket Event feed:new_post.

Thông báo cho tác giả: User A nhận được thông báo thời gian thực: "User B đã chia sẻ bài viết của bạn".

2.3. Chia sẻ trực tiếp qua Tin nhắn Chat (Share via Chat)
Mô tả: Người dùng gửi nhanh bài viết vào một hoặc nhiều hộp thoại chat (Chat đơn hoặc Chat nhóm).

Yêu cầu nghiệp vụ:

Khi bấm "Chia sẻ qua tin nhắn", hệ thống hiển thị một danh sách (Pop-up) gồm các cuộc hội thoại gần nhất và một thanh tìm kiếm bạn bè.

Người dùng có thể chọn nhiều phòng chat cùng lúc và bấm "Gửi". Có thể nhập kèm lời nhắn (Text).

Luồng xử lý Realtime (Tích hợp với module Chat):

Bài viết được cấu trúc thành một loại tin nhắn đặc biệt (message_type: "SHARE_POST").

Tại phòng chat mục tiêu: Tin nhắn chứa thẻ bài viết (gồm tiêu đề, ảnh thumbnail, tên tác giả) lập tức xuất hiện trong hộp thoại chat của các thành viên theo thời gian thực (chat:new_message).

Người nhận trong phòng chat có thể click trực tiếp vào Thẻ tin nhắn này để chuyển hướng nhanh (Redirect) đến xem bài viết chi tiết trên News Feed.

2.4. Xử lý kịch bản Bài viết gốc bị Xóa (Handle Original Post Deletion)
Khi tác giả gốc (User A) xóa bài viết gốc của họ:

Trên News Feed: Tất cả các bài viết chia sẻ lại (Shared Posts) của người khác sẽ không bị xóa, nhưng phần nội dung gốc bên trong sẽ chuyển thành trạng thái: "Bài viết gốc đã bị xóa hoặc không còn tồn tại".

Trong Phòng Chat: Thẻ bài viết đã chia sẻ trong lịch sử chat sẽ chuyển hiển thị thành: "Nội dung không tồn tại". 3. Yêu Cầu Giao Diện (UI/UX Requirements)
Thành phần UI,Quy chuẩn hiển thị,Trải nghiệm người dùng
Nút bấm Chia sẻ,Nằm ở góc phải chân trang bài viết (Cạnh nút Like và Comment).,"Khi click, hiển thị Menu Dropdown/Pop-over gồm 2 tùy chọn: ""Chia sẻ lên bảng tin"" và ""Gửi qua chat""."
Khung bài viết chia sẻ (Shared Card),"Khung bài viết gốc được thu nhỏ gọn gàng, bo góc và đổi màu nền (ví dụ: nền xám nhạt) để phân biệt rõ với nội dung viết thêm của người chia sẻ.",Click vào bất kỳ vùng nào trên khung này (trừ tên tác giả) sẽ mở ra trang chi tiết của bài viết gốc.
Thẻ bài viết trong Chat (Chat Bubble),"Thiết kế nhỏ gọn, hiển thị tối đa 3 dòng chữ của bài viết gốc kèm 1 hình ảnh đại diện (nếu bài viết có media).","Có nút ""Xem bài viết"" trực tiếp trên bong bóng chat."
