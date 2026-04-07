# 🚀 Git Commit & Branching Guideline (NestJS + Next.js)

Tài liệu này quy định cách làm việc với Git trong dự án nhằm:
- Tránh conflict
- Dễ review code
- Quản lý version rõ ràng
- Làm việc nhóm hiệu quả

---

## 🌿 1. Cấu trúc Branch

Hiện tại project có 2 nhánh chính:

- `main`: code production (stable, deploy)
- `dev`: code phát triển chính

Ngoài ra, mỗi dev sẽ tạo branch riêng:

### Quy tắc đặt tên branch:

Ví dụ:
- `feature/login-api`
- `feature/ui-homepage`
- `fix/auth-bug`
- `hotfix/crash-server`

### Các loại branch:
- `feature/`: phát triển tính năng mới
- `fix/`: sửa bug
- `hotfix/`: fix gấp trên production
- `refactor/`: tối ưu code, không đổi logic
