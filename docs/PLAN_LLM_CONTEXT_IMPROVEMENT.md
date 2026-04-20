# Kế hoạch Cải thiện Ngữ cảnh (Context) cho LLM trong tính năng Chat — (Cập nhật thay đổi thực tế)

Tài liệu này đã được cập nhật để phản ánh các chỉnh sửa thực tế đã triển khai trong mã nguồn (các service MCP). Dưới đây là tóm tắt thay đổi, lý do và hướng dẫn kiểm thử.

## 1. Tóm tắt các vấn đề đã gặp

- Ban đầu LLM đôi khi không nhận ra rằng cần phải upload một file mới trước khi trả lời (gọi `logistics_upload_document`).
- Lần gọi thứ hai (tổng hợp sau tool) đã cho phép model tiếp tục gọi tool, dẫn đến `reply` rỗng hoặc model trả về `tool_calls` thay vì content.
- Model đôi khi trả về tham số tool dưới dạng JSON bị méo/malformed (ví dụ: hai objects dính vào nhau), gây lỗi khi backend gọi `JSON.parse` — dẫn tới log lỗi kiểu: "Failed to parse tool arguments for [logistics_upload_document]".

## 2. Thay đổi đã thực hiện (file & logic)

Những sửa đổi chính đã được áp dụng trong `xpress-backend/src/modules/mcp/services`:

- `mcp-prompt.service.ts`
  - Viết lại System Prompt thành một chuỗi mạnh mẽ, cụ thể (nêu rõ quy tắc: nếu có file URL thì phải gọi `logistics_upload_document`; khi trả lời phải dùng `logistics_ask_question`/`logistics_search_knowledge` cho truy vấn về nội dung file; nhắc check lịch sử để tìm file gần nhất).
  - Lấy lịch sử bằng `mcpHistoryService.getHistory(userId)` và giữ 15 tin nhắn gần nhất (`history.slice(-15)`), duy trì thứ tự thời gian (cũ -> mới). Đối với những tin nhắn user có `fileUrl`, chú thích vào nội dung tin nhắn để model biết URL và trạng thái (mới vs đã index).
  - Khi không có `userId`, fallback vẫn thêm thông báo hệ thống kèm `fileUrl` (nếu client gửi kèm) để ép model gọi upload.

- `mcp-llm.service.ts`
  - Giữ nguyên cuộc gọi lần 1 (`decideActions`) với `tools` để model quyết định tool cần gọi.
  - Thay đổi `synthesizeResults` (lượt 2): BỎ `tools` khi gọi LLM lần 2 — mục tiêu buộc model sinh text content thay vì tiếp tục gọi tool. Nếu model vẫn trả về `tool_calls` mà không có `content`, hàm sẽ trả về một fallback message giải thích rằng model muốn gọi thêm tool nhưng server chỉ cho phép 1 lượt tổng hợp (tránh reply rỗng).
  - Nếu nhà cung cấp LLM (OpenRouter) lỗi ở lần tổng hợp, service sẽ fallback lấy tất cả messages có role=`tool` và trả về Raw Tool Output để người dùng vẫn nhận được dữ liệu phân tích.

- `mcp.service.ts`
  - Khi nhận `responseMessage.tool_calls` từ LLM, service push `responseMessage` vào mảng `messages` (để giữ context tool_call_id khi gửi lại cho lần tổng hợp).
  - Thực thi tool calls tuần tự bằng `mcpClientService.callTool(functionName, functionArgs)`.
  - THÊM logic robust để parse `toolCall.function.arguments`:
    - Trước tiên xóa các lỗi thường gặp: trailing commas, markdown ```json blocks.
    - Nếu JSON.parse thất bại, thử tìm và extract một JSON object phù hợp bằng regex (ưu tiên khối chứa `"fileUrl"`, sau đó `"queryText"`) và parse lại.
    - Nếu vẫn thất bại, trả về lỗi có ý nghĩa cho frontend thay vì crash (log chi tiết kèm raw args).
  - Sau khi tool trả về results, push một message role:`tool` với nội dung text thu thập được và gọi `synthesizeResults(messages)` (lần 2) để model tổng hợp thành câu trả lời cuối cùng.
  - Lưu kết quả finalReply vào lịch sử (mcpHistoryService.saveMessage) nếu có userId.

## 3. Lý do kỹ thuật cho các thay đổi

 - System Prompt mạnh hơn giúp các mô hình nhỏ (hoặc provider có hành vi không ổn định) làm theo quy tắc nghiệp vụ: upload trước khi trả lời liên quan file.
 - Không truyền `tools` cho lượt tổng hợp buộc model trả về text, tránh vòng lặp tool-calls -> tool-calls.
 - JSON-repair (RegEx extraction) là một pragmatic fallback vì nhiều model trả về JSON kèm markdown hoặc dính hai khối JSON. Việc recover `fileUrl`/`queryText` giúp hệ thống tự sửa lỗi và tiếp tục luồng xử lý thay vì trả lỗi thô cho user.

## 4. Hướng dẫn kiểm thử nhanh (smoke test)

1. Workflow upload + summary (happy path):
   - Gửi request tới `/mcp/chat` với message kèm `fileUrl`.
   - Kiểm tra log: LLM quyết định gọi `logistics_upload_document` ở lượt 1.
   - Tool `logistics_upload_document` được gọi và trả về số lượng chunks/indexed.
   - Lượt 2 model tổng hợp (không gọi tool) và trả về nội dung tóm tắt; `finalReply` được lưu vào history.

2. Workflow tóm tắt sau upload (multi-turn):
   - Gửi lần 2 một câu "Tóm tắt nội dung chính trong file trên" (không gửi lại fileUrl).
   - Kiểm tra rằng `mcpPromptService` đã chèn lịch sử trước khi gọi LLM và model cố gắng gọi `logistics_ask_question`/`logistics_search_knowledge` thay vì upload lại.

3. Malformed tool args recovery:
   - Giả lập LLM trả về một chuỗi arguments bị dính 2 JSON vào nhau (mô phỏng lỗi trong log). Hệ thống sẽ:
     - Thử sửa sạch (remove trailing commas / code fences).
     - Nếu parsing fail, extract khối JSON có `fileUrl` hoặc `queryText` và parse lại.
     - Nếu phục hồi thành công, tool sẽ được gọi bình thường; nếu không, client nhận được lỗi rõ ràng.

## 5. Các file liên quan (delta)

 - `xpress-backend/src/modules/mcp/services/mcp-prompt.service.ts`
   - Mục tiêu: System prompt, history injection, annotate user messages with fileUrl and whether it's newly uploaded or previously indexed.

 - `xpress-backend/src/modules/mcp/services/mcp-llm.service.ts`
   - Mục tiêu: Giữ nguyên lượt 1 với tools; lượt 2 không có tools; fallback nếu model tiếp tục trả tool_calls; fallback raw tool output nếu LLM lỗi.

 - `xpress-backend/src/modules/mcp/services/mcp.service.ts`
   - Mục tiêu: Gọi tool, robust JSON parse + repair, push tool results into messages, gọi tổng hợp lần 2, lưu history.

## 6. Rủi ro & Next steps

 - Rủi ro: RegEx repair là pragmatic nhưng không hoàn hảo — nếu provider đổi format tool_calls, có thể cần bổ sung thêm patterns hoặc dùng thư viện repair JSON (ví dụ `jsonrepair` hoặc `safe-json-parse/try`) trước khi productionize.
 - Nên thêm unit tests cho parsing logic (`toolCall.function.arguments`) để bảo vệ chống regressions.
 - Nên log và alert (Sentry/Logs) khi fallback repair được kích hoạt để thống kê tần suất malformed responses từ LLM và cân nhắc thay đổi provider/ model/ prompt tuning.

## 7. Mapping yêu cầu ban đầu → trạng thái hiện tại

 - Yêu cầu: "LLM phải nhớ file người dùng đã upload và dùng tool để trả lời" → Done (history injection + system prompt + tool-first behavior).
 - Yêu cầu: "Không trả về `reply: ''` khi có tool calls" → Done (bỏ tools ở lượt 2, fallback handling).
 - Yêu cầu: "Giải quyết lỗi parse tool args" → Done (cleaning + regex-extract recovery, trả lỗi rõ ràng nếu không recover được).

Nếu bạn muốn, tôi có thể:
 - Thêm unit tests (Jest) cho `mcp.service` parsing logic.
 - Thay RegEx repair bằng một thư viện JSON repair an toàn hơn.
 - Tinh chỉnh system prompt thêm các examples (few-shot) để giảm tỷ lệ ảo giác (hallucination) khi tạo tool arguments.

---

Ghi chú: nếu bạn muốn tôi cập nhật file `docs/PLAN_LLM_CONTEXT_IMPROVEMENT.md` thêm ví dụ logs thực tế (các đoạn log bạn đã gửi), hoặc tạo PR với các thay đổi code + tests, nói tôi biết và tôi sẽ làm tiếp.
 