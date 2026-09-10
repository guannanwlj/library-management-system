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
python3 -m unittest discover -s tests  # 运行 Python 命令行单元测试
```

## 目录
- `src/domain/book.ts`：`Book` 实体、`BookStatus` 枚举与工厂/错误。
- `src/domain/borrow-record.ts`：借阅记录（`borrower`）读写/清除约定。
- `src/store/book-store.ts`：进程内 `BookStore` 集合与单例 `bookStore`。
- `src/data/sample-books.ts`：样例图书清单与启动初始化 `initializeSampleBooks`。
- `src/rules/borrow-rules.ts`：借阅/归还状态规则与固定错误文案（纯判定）。
- `src/features/list-books.ts`：`list` 图书列表的格式化与处理器（消费 `BookStore`）。
- `src/features/borrow-book.ts`：借出执行与状态变更（`borrow(bookId, borrower)`）。
- `src/features/return-book.ts`：`returnBook(bookId)` 归还执行与状态恢复（FP-009）。
- `library/`：命令行入口（`python3 -m library list`）与 `list` 命令处理；
  `library/borrow_books.py` 为同契约的 Python 借出执行，`library/return_book.py` 为与 TS 等价的 Python 侧归还执行。
- `docs/designs/`：设计说明；`docs/test-cases/`：测试用例清单。
