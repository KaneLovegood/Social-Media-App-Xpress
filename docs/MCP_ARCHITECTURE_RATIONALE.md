# Giải thích về Kiến trúc: Truy cập Database trực tiếp trong MCP Server

## 1. Bối cảnh
Trong quá trình triển khai các tính năng Social và Group Chat cho AI Assistant (MCP), chúng tôi đã chọn phương án cho phép **Logistics MCP Server** tương tác trực tiếp với **DynamoDB** (bảng `Users`) thay vì gọi qua các Rest APIs của backend.

## 2. Lý do chọn phương án truy cập trực tiếp

### A. Hiệu năng và Độ trễ (Performance & Latency)
- **Hạn chế Network Hops**: Việc AI gọi tool liên tiếp (Tool Chaining) yêu cầu tốc độ phản hồi cực nhanh. Nếu mỗi tool call lại phải thực hiện một request HTTP sang backend, sau đó backend mới query DB, tổng thời gian chờ (latency) sẽ tăng lên đáng kể, làm giảm trải nghiệm hội thoại.
- **Tương tác thời gian thực**: Trực tiếp query DB giúp AI xử lý các luồng phức tạp (ví dụ: Tìm người -> Tạo nhóm -> Thêm thành viên) trong vài giây thay vì phải đợi các lớp API trung gian.

### B. Tính nhất quán về Dữ liệu (Data Consistency)
- **Chia sẻ Schema**: MCP Server sử dụng đúng các mẫu PK/SK (`USER#`, `ROOM#`, `META#`) và cấu trúc thực thể giống hệt `xpress-backend`. Điều này đảm bảo dữ liệu mà AI tạo ra hoàn toàn tương thích với logic hiện có của hệ thống.
- **Giao dịch nguyên tử (Atomic Transactions)**: Chúng tôi sử dụng `TransactWriteCommand` của AWS SDK để đảm bảo các thao tác quan trọng (như tạo nhóm và thêm thành viên) được thực hiện một cách an toàn, tránh dữ liệu rác.

### C. Tối ưu hóa cho AI (LLM Optimization)
- **Khả năng tự chủ**: AI cần dữ liệu thô và cấu trúc dữ liệu phẳng để "suy nghĩ" và đưa ra quyết định. Các API backend thường trả về dữ liệu đã qua xử lý (DTOs) đôi khi bị lược bỏ thông tin cần thiết cho Logic AI.
- **Tool Chaining mượt mà**: Khi AI có quyền truy cập tầng dữ liệu, nó có thể tự mình thực hiện các logic kết nối mà không cần backend phải viết thêm các API phối hợp (orchestration APIs) phức tạp.

## 3. Bảo mật và Quản lý
- **Shared Secrets**: Cả backend và MCP server đều chạy trong cùng một hạ tầng an toàn, chia sẻ chung các biến môi trường (`AWS_ACCESS_KEY`, v.v.).
- **Tách biệt trách nhiệm**: Backend tập trung vào logic nghiệp vụ của người dùng cuối (App), trong khi MCP tập trung vào việc biến dữ liệu đó thành "tri thức" và "hành động" cho AI Assistant.

## 4. Giải đáp về Bản chất của MCP (Model Context Protocol)

Có thể bạn sẽ thắc mắc liệu việc truy cập DB trực tiếp có đi ngược lại tinh thần của MCP hay không. Câu trả lời là **KHÔNG**, ngược lại, nó còn phát huy đúng thế mạnh của MCP:

- **MCP là một Giao thức (Protocol), không phải một Ràng buộc triển khai**: MCP sinh ra để tạo ra một "ngôn ngữ chung" giữa AI và các nguồn lực (Resources/Tools). Nó không quy định lớp bên dưới phải là API hay DB.
- **Tính trừu tượng (Abstraction)**: Bản chất của MCP là biến các logic phức tạp (ở đây là DynamoDB Queries) thành những công cụ đơn giản mà LLM có thể hiểu. Việc MCP Server nằm trực tiếp trên Database giúp nó trở thành một "Data-native Bridge" cực kỳ hiệu quả.
- **Context richness (Sự phong phú của ngữ cảnh)**: AI hoạt động tốt nhất khi có ngữ cảnh sâu. Truy cập trực tiếp cho phép MCP Server lấy được toàn bộ metadata và các mối quan hệ thực thể mà đôi khi các APIs thông thường bị giới hạn.
- **Local vs Remote**: Trong hệ sinh thái MCP, các "Local Servers" thường có quyền truy cập trực tiếp vào tài nguyên hệ thống (File, DB, Process) để phục vụ AI một cách nhanh nhất.

## 5. So sánh: Truy cập DB trực tiếp vs. Gọi qua API Backend

Dù phương án nào cũng đều được gọi là **MCP** nếu tuân thủ giao thức kết nối. Dưới đây là bảng so sánh ưu nhược điểm:

| Đặc điểm | Truy cập DB trực tiếp (Hiện tại) | Gọi qua API Backend (Phương án thay thế) |
| :--- | :--- | :--- |
| **Độ trễ (Latency)** | **Thấp nhất**: Không có thêm bước nhảy mạng (network hop). | **Cao hơn**: LLM -> Backend -> MCP -> Backend API -> DB. |
| **Độ phức tạp** | **Thấp**: Code tập trung tại một chỗ, dễ debug luồng dữ liệu. | **Cao**: Phải quản lý API contracts, Auth giữa các service. |
| **Sự phong phú ngữ cảnh** | **Rất cao**: AI thấy được toàn bộ schema và quan hệ thô. | **Trung bình**: Dữ liệu thường bị lược bỏ/phân trang qua API. |
| **Tính bảo mật** | **Tập trung**: Cần bảo vệ AWS keys tại MCP server. | **Phân tán**: Backend có thể chặn/kiểm tra quyền ở lớp API. |
| **Bảo trì Layer** | **Chặt chẽ**: Thay đổi DB schema yêu cầu cập nhật cả MCP. | **Lỏng lẻo**: Chỉ cần Backend API không đổi, MCP sẽ ổn định. |
| **Phù hợp** | Phụ trách các luồng AI phức tạp, cần real-time cực nhanh. | Phụ trách các luồng có logic nghiệp vụ (business rules) dày đặc. |

## 6. Kết luận
Việc query trực tiếp không phải là "vượt mặt" Backend, mà là **mở rộng khả năng của hệ thống** sang một giao diện mới (AI Interface) với hiệu suất tối đa. Cách tiếp cận này giúp AI Assistant cảm thấy "thông minh" và "phản ứng nhanh" hơn đối với mọi yêu cầu của người dùng, hoàn toàn đúng với triết lý "kết nối tri thức" của MCP. 

Tùy vào quy mô sau này, nếu hệ thống trở nên cực kỳ lớn với hàng trăm Microservices, chúng ta có thể chuyển sang dùng API để tăng tính đóng gói. Nhưng ở giai đoạn tối ưu hóa trải nghiệm người dùng hiện tại, **Direct DB Access là lựa chọn tối ưu nhất**.
