Yêu Cầu UX/UI: Chức Năng Tìm Kiếm & Kết Bạn

1. Thanh tìm kiếm và Bộ lọc (Search Bar & Filters)
   Yêu cầu UI (Giao diện)
   Vị trí: Nằm ở vị trí dễ thấy nhất (thường là trên cùng) của màn hình Quản lý bạn bè hoặc Danh sách chat.

Thành phần:

Có icon kính lúp ở góc trái thanh tìm kiếm làm chỉ báo trực quan.

Có nút [X] (Clear button) ở góc phải để xóa nhanh nội dung vừa nhập.

Placeholder gợi ý rõ ràng: "Tìm kiếm theo số điện thoại, email hoặc username...".

Trạng thái (States): Định hình rõ 3 trạng thái: Mặc định (Default), Đang focus (Active - đổi màu viền thanh search), và Có kết quả (Result hiển thị).

Yêu cầu UX (Trải nghiệm)
Cơ chế Instant Search (Tìm kiếm tức thì): Áp dụng kỹ thuật Debounce (khoảng 300ms - 500ms). Khi người dùng đang gõ, hệ thống không bắt họ nhấn nút "Enter" hay "Tìm kiếm", kết quả sẽ tự động hiển thị mượt mà bên dưới sau khi họ ngừng gõ 300ms.

Hiệu ứng Loading trực quan: Trong lúc hệ thống truy vấn dữ liệu (Querying), hiển thị một icon loading xoay tròn nhỏ (Spinner) thay thế cho icon kính lúp hoặc hiển thị thanh hiệu ứng chạy ngầm (Skeleton loading) ở vùng kết quả để người dùng biết hệ thống đang xử lý, tránh cảm giác bị "đơ" máy.

2. Thẻ hiển thị kết quả tìm kiếm (User Search Result Card)
   Yêu cầu UI (Giao diện)
   Mỗi người dùng tìm thấy sẽ hiển thị dưới dạng một "Thẻ kết quả" (User Card) nằm dọc bao gồm các thành phần cố định:

Avatar (Ảnh đại diện): Hình tròn, kích thước chuẩn (ví dụ: 48x48px). Nếu không có ảnh, hiển thị chữ cái đầu của tên trên nền màu ngẫu nhiên.

Thông tin định danh: Tên hiển thị (Bold chữ đậm), bên dưới là Username hoặc Số điện thoại/Email (chữ nhỏ hơn, màu xám nhạt) để người dùng xác nhận đúng đối tượng.

Nút hành động (Action Button): Nằm ở phía bên phải ngoài cùng của thẻ.

Yêu cầu UX (Trải nghiệm)
Trạng thái động của nút bấm (Dynamic Button States): Màu sắc và nội dung của nút hành động phải thay đổi ngay lập tức (realtime) dựa trên mối quan hệ giữa 2 người:

Chưa là bạn bè: Nút có màu chủ đạo (ví dụ: Xanh dương), chữ "Kết bạn" kèm icon +.

Đã gửi lời mời (Chờ đối phương đồng ý): Nút đổi sang màu trung tính (Xám), chữ chuyển thành "Đã gửi" hoặc "Hủy lời mời".

Đối phương đang chờ mình đồng ý: Hiển thị bộ đôi nút cụ thể: "Chấp nhận" (Màu xanh) và "Từ chối" (Màu xám/đỏ).

Đã là bạn bè: Nút chuyển thành "Nhắn tin" (Màu trắng viền xanh) để chuyển nhanh sang cửa sổ chat.

Xử lý kịch bản rỗng (Empty States):

Nếu nhập sai hoặc không tìm thấy ai: Hiển thị một hình minh họa (Illustration) kèm dòng chữ: "Không tìm thấy kết quả phù hợp".

Nếu người dùng tự gõ thông tin của chính mình: Không hiển thị nút kết bạn, thay vào đó hiển thị nhãn (Bạn) bên cạnh tên.

3. Quản lý danh sách lời mời (Pending Requests List)
   Yêu cầu UI (Giao diện)
   Huy hiệu thông báo (Badge Count): Tại biểu tượng danh mục "Lời mời kết bạn" trên thanh menu chính, bắt buộc phải có một chấm đỏ hiển thị số lượng lời mời đang chờ xử lý (Ví dụ: 5). Chấm đỏ này phải tự động nhảy số theo thời gian thực nhờ Socket khi có người khác gửi lời mời đến.

Cấu trúc Tab rõ ràng: Người dùng dễ dàng chuyển đổi qua lại giữa 2 danh sách: "Lời mời đã nhận" và "Lời mời đã gửi" bằng một cái chạm.

Yêu cầu UX (Trải nghiệm)
Realtime Animation (Hiệu ứng thời gian thực):

Khi người dùng bấm "Đồng ý" hoặc "Từ chối" một lời mời, thẻ người dùng đó phải có hiệu ứng mờ dần (Fade-out) hoặc trượt thu nhỏ lại và biến mất khỏi danh sách chờ một cách mượt mà, thay vì biến mất đột ngột làm giật lag giao diện.

Đồng thời, số lượng trên Badge thông báo tự động trừ đi -1 ngay lập tức.

Hành động hoàn tác (Undo Action): Đối với nút "Từ chối" hoặc "Hủy lời mời đã gửi", hệ thống nên hiển thị một thông báo Toast nhỏ ở dưới cùng màn hình trong 3 giây: "Đã xóa lời mời. [Hoàn tác]" để người dùng bấm lại nếu lỡ tay bấm nhầm.

4. Quản lý trạng thái danh sách Bạn bè (Friend List - Active Status)
   Yêu cầu UI (Giao diện)
   Chỉ báo trạng thái hoạt động (Activity Indicator):

Online: Chấm tròn màu xanh lá cây viền trắng đè lên góc dưới bên phải của Avatar người dùng.

Offline: Không có chấm hoặc chấm màu xám, hiển thị thêm dòng chữ nhỏ bên cạnh tên hoặc dưới tên: "Hoạt động x phút trước", "Hoạt động 2 ngày trước".

Yêu cầu UX (Trải nghiệm)
Sắp xếp thông minh (Smart Sorting): Danh sách bạn bè mặc định nên ưu tiên đưa những người đang Online lên trên cùng để kích thích người dùng bấm vào nhắn tin, sau đó mới đến những người Offline xếp theo thứ tự bảng chữ cái (A-Z).

Menu thao tác nhanh (Quick Actions): Khi vuốt (Swipe) thẻ bạn bè sang trái (trên Mobile) hoặc bấm vào icon 3 chấm (trên Web/Desktop), hiển thị các hành động nhanh: Hủy kết bạn, Chặn, Xem trang cá nhân để người dùng không phải click vào sâu bên trong cấu trúc menu phức tạp.
