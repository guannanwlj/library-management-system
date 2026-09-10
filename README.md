# library-management-system

本地运行的图书馆管理 MVP：命令行完成「借书 / 还书 / 查看图书列表」，
数据仅保存在进程内存中（重启即清空）。

## 技术栈
TypeScript + Node.js（内置 `node:test`，经 `tsx` 运行）。

## 开发
```bash
npm install
npm test        # 运行单元测试
npm run typecheck  # 类型检查
npm run build   # 编译到 dist/
```

## 目录
- `src/domain/book.ts`：`Book` 实体、`BookStatus` 枚举与工厂/错误。
- `src/domain/borrow-record.ts`：借阅记录（`borrower`）读写/清除约定。
- `src/store/book-store.ts`：进程内 `BookStore` 集合与单例 `bookStore`。
- `docs/designs/`：设计说明；`docs/test-cases/`：测试用例清单。
