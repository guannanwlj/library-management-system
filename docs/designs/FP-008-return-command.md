# 设计说明 FP-008：归还命令入口

> 任务来源：FP-008（源 UC-002 归还图书 ｜ 界面与交互）｜优先级 P1｜
> 里程碑 M2｜并发波次 4
> 强依赖：FP-005 命令行入口框架、FP-009 归还执行与状态恢复
> 技术栈：语言无关（本仓库实际为 TypeScript + Python 双栈，见 §2）。

## 1. 目标与范围

把 `return <bookId>` 的输入接到归还执行上：解析子命令的一个参数
（图书编号）→ 调用 FP-009 的 `returnBook(bookId)` → 把结果文案
（成功提示或固定错误文案）原样输出。

范围外（任务卡 §5）：

- 归还状态恢复与合法性校验（FP-009）。
- 命令行框架本身（FP-005）。
- 借阅与列表命令（FP-006 / FP-010）。

本任务只在「命令行层与归还逻辑之间接线」，不含任何规则判定。

## 2. 关键决策

### D1 双栈各落一份入口，对齐各自的上游运行时

与 FP-010（列表命令入口）同样的情形：两个强依赖分属不同运行时。

- FP-005 命令行入口框架 → **Python**（`library/cli.py`）。
- FP-009 归还执行 → 两处都有：TS `src/features/return-book.ts`
  与 PY `library/return_book.py`（FP-009 已按双栈交付）。

因此本任务在两个运行时各提供一份薄入口，共享同一行为契约（§3）：

- TS：`src/features/return-command.ts`，消费真实 FP-009 的
  `returnBook(bookId)`，并提供 `return` 处理器与注册适配器（分发面
  按 FP-005 §3.2 的 `register(name, handler)` 形状对齐）。
- PY：`library/return_command.py`，挂载到真实 FP-005 的分发器上，
  覆盖 `return` 占位处理器，复用 PY 侧 FP-009 的 `return_book(book_id)`。

### D2 只解析与透传，不做业务判定

处理器只做三件事：取第一个 token 作为 `bookId`、调用归还执行、返回
`result.message`。拒绝路径与状态恢复全部由 FP-009 负责，本任务不重复
判定（任务卡 §5）。

### D3 参数解析口径

- 取 `args[0]` 作为图书编号。
- **缺失参数**：视为空串传给归还执行；FP-009 已把空 / 纯空白编号
  判为「图书不存在」，故输出「图书不存在」。复用既有契约，不新造
  「用法提示」文案。
- **多余参数**：忽略，仅用第一个 token（与 FP-005「原样透传」和
  `list` 忽略多余参数一致）。

### D4 输出即归还执行的结果文案

- 成功：`归还成功`（FP-009 `RETURN_SUCCESS_MESSAGE`，供入口直接打印）。
- 失败：FP-004 的固定错误文案逐字透传（`图书不存在` /
  `该图书未借出`）。

不额外拼接编号或前缀，最贴近任务卡「输出归还成功或错误提示」。

### D5 注入隔离集合以便测试

处理器构造函数接收可选 `store`，默认进程内单例，测试注入独立集合，
避免污染 `library.book_store.book_store` / TS `bookStore`。

### D6 抽取共享的命令分发契约（TS 侧）

FP-008 与 FP-010 都需要「处理器形状 + 注册面」两个类型。原先定义在
`list-books.ts` 的 `ListHandler` / `CommandRegistrar` 抽到
`src/features/command.ts`，`list-books.ts` 以类型别名 / 再导出保持
既有 API，避免两处各写一份同形接口。

## 3. 模块结构

```
src/features/command.ts        CommandHandler / CommandRegistrar（FP-005 契约形状）
src/features/return-command.ts ReturnHandler / parseReturnBookId /
                               createReturnCommandHandler(store) /
                               registerReturnCommand(registrar, store)
tests/return-command.test.ts   node:test 单元测试

library/return_command.py      parse_book_id / create_return_handler(store)
library/__init__.py            导入时把真实 return 处理器挂到 library.cli.dispatcher
tests/test_return_command.py   unittest 单元测试
```

对外 API：

```ts
// TypeScript
parseReturnBookId(args: readonly string[]): string
createReturnCommandHandler(store?: BookStore): ReturnHandler
registerReturnCommand(registrar, store?: BookStore): ReturnHandler
```

```python
# Python
parse_book_id(args) -> str
create_return_handler(store=None) -> Handler
```

## 4. 验证方式

- TypeScript：`npm test`（`tsx --test tests/*.test.ts`）运行
  `tests/return-command.test.ts`；`npm run typecheck` 做类型检查。
- Python：`python3 -m unittest discover -s tests -v` 运行
  `tests/test_return_command.py`（含 `python3 -m library return ...`
  子进程冒烟）。
- 用例清单见 `docs/test-cases/FP-008-return-command.md`。
