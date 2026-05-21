2. Các luồng nghiệp vụ chính (Use Cases & Workflows)
   A. Tìm kiếm người dùng
   Mô tả: Người dùng có thể tìm kiếm người khác để gửi lời mời kết bạn.

Yêu cầu:

Tìm kiếm qua: Số điện thoại, Email, hoặc Username/ID.

Kết quả trả về: Hiển thị Avatar, Tên hiển thị và trạng thái quan hệ hiện tại (Chưa là bạn bè, Đã gửi lời mời, Chờ phản hồi, Đã là bạn bè).

Không cho phép tự tìm kiếm chính mình.

B. Gửi lời mời kết bạn (Send Friend Request)
Mô tả: Người dùng A gửi lời mời kết bạn cho người dùng B.

Yêu cầu realtime:

Ngay khi A ấn "Kết bạn", nút bấm của A chuyển thành "Đã gửi lời mời".

Hệ thống gửi một thông báo realtime (Push Notification / Socket Event) đến tài khoản của B.

Tại màn hình của B, số lượng thông báo (Badge) ở tab "Lời mời kết bạn" tự động tăng lên +1.

C. Quản lý lời mời kết bạn (Received/Sent Requests)
Mối với lời mời đã nhận (Received): Người dùng có 2 lựa chọn:

Đồng ý (Accept):

Trạng thái chuyển thành "Bạn bè".

Cả hai người dùng tự động xuất hiện trong "Danh sách bạn bè" của nhau (cập nhật realtime).

Hệ thống tự động tạo một phòng chat đôi (Direct Message) giữa 2 người (hoặc kích hoạt lại nếu đã có lịch sử).

Gửi thông báo realtime cho người gửi: "B đã chấp nhận lời mời kết bạn".

Từ chối (Decline/Ignore):

Xóa lời mời khỏi danh sách chờ.

Không thông báo cho người gửi biết (để đảm bảo tính riêng tư). Người gửi sẽ thấy nút bấm quay về trạng thái "Kết bạn" ban đầu.

Đối với lời mời đã gửi (Sent): Người dùng có thể chọn Hủy lời mời (Cancel Request) nếu đối phương chưa phản hồi.

D. Hủy kết bạn (Unfriend)
Mô tả: Người dùng xóa một người ra khỏi danh sách bạn bè.

Yêu cầu:

Yêu cầu xác nhận (Pop-up: "Bạn có chắc chắn muốn hủy kết bạn với X?").

Sau khi xác nhận, xóa quan hệ bạn bè trong Database.

Realtime: Cập nhật ngay lập tức danh sách bạn bè của cả 2 bên (xóa tên nhau ra khỏi danh sách online/offline).

E. Chặn người dùng (Block)
Mô tả: Người dùng không muốn nhận tin nhắn hoặc lời mời từ một người cụ thể.

Yêu cầu:

Khi A chặn B: B không thể tìm thấy A, không thể gửi lời mời kết bạn và không thể gửi tin nhắn cho A.

Mối quan hệ bạn bè cũ (nếu có) sẽ tự động bị hủy.

3. Giao diện người dùng (UI/UX Requirements)
   Hệ thống cần phân chia rõ ràng các tab/mục trong danh mục "Bạn bè":

Danh sách bạn bè (Friend List): Hiển thị những người đã là bạn bè, kèm trạng thái On/Off trực quan (Chấm xanh: Online, Chấm xám: Offline kèm thời gian off gần nhất).

Lời mời đã nhận (Pending Requests): Danh sách các lời mời đang chờ duyệt, có nút Đồng ý và Từ chối trực diện.

Lời mời đã gửi (Sent Requests): Danh sách các lời mời mình đã phát đi, có nút Hủy.

Danh sách chặn (Blacklist/Blocked): Quản lý những người đã chặn, có nút Bỏ chặn.
