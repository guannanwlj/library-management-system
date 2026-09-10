# 设计说明 FP-006：借阅命令入口

> 任务来源：FP-006（源 UC-001 借阅图书 ｜ 界面与交互）｜
> 优先级 P1｜里程碑 M2｜并发波次 4
> 强依赖：FP-005 命令行入口框架、FP-007 借出执行与状态变更（均已实现）。
> 技术栈：语言无关（本仓库实际为 TypeScript + Python 双栈，见 §2）。

## 1. 目标与范围

命令行层到借出逻辑的接线：把 `borrow <bookId> <borrower>` 的输入解析
出来、校验参数、交给借出执行，再把结果文本输出。

范围外（任务卡 §5）：
- 借出状态变更与合法性校验（FP-007），本任务只解析与透传结果。
- 命令行框架本身（FP-005）。
- 归还与列表命令（FP-008 / FP-010）。

## 2. 关键决策

### D1 双栈实现，与 FP-010 同理
两个强依赖分属不同运行时：

- FP-005 命令行入口框架 → **Python**（`library/cli.py` 的
  `CommandDispatcher` / 模块级 `register`）。
- FP-007 借出执行 → **TS**（`src/features/borrow-book.ts`）与
  **Python**（`library/borrow_books.py`）各有一份。

因此本任务在两侧各提供一份薄入口：Python 侧挂到真实 FP-005 分发器上；
TypeScript 侧提供与 FP-010 `registerListCommand` 同形状的处理器与注册
适配器（分发面按 FP-005 §3.2 的 `register(name, handler)` 对齐）。
两侧共享同一份**输出契约**（结果文本即 FP-007 的 `message`）。

### D2 入口自己校验参数，不依赖执行层兜底
任务卡 §4 要求入口「校验参数个数与借阅人非空，缺失时拒绝并提示
『借阅人标识缺失』」。因此入口在调用 FP-007 **之前**判定：

- 参数不足两个 token，或第二个 token 为纯空白 → 直接返回
  `借阅人标识缺失`，**不调用**借出执行（不触碰集合）。
- 借阅人非空时，原样（不 `trim`）传给 FP-007，遵守 FP-003 自由文本
  原样保存的约定。

虽然 FP-007 内部也会做同样的判定，但入口层校验保证「缺参」表现为命令
层错误，且不因执行层实现差异而改变。

### D3 结果文本 = 执行结果的 `message`
借用执行契约 `borrow(bookId, borrower) -> { ok, message }`。成功时输出
`借阅成功`，失败时**逐字透传** FP-004 的错误文案（`图书不存在` /
`该图书已借出` / `借阅人标识缺失`）。入口不新增文案，也不依赖 `ok`。

### D4 多余 token 忽略
FP-005 会把子命令之后的全部 token 原样传入。入口只取前两个 token
（`bookId`、`borrower`），其余忽略，与 `list` 处理器忽略多余参数的
行为一致。

### D5 执行能力可注入
为便于隔离测试，处理器构造时允许注入一个 `(bookId, borrower) ->
message` 形状的执行函数；默认绑定到进程内单例集合的
`borrow_books.borrow` / `borrow`。

## 3. 模块结构

TypeScript（消费真实 FP-007）：

```
src/features/borrow-command.ts   BORROWER_MISSING_MESSAGE / parseBorrowArgs /
                                 handleBorrow / createBorrowHandler /
                                 registerBorrowCommand
src/index.ts                     对外桶导出补充本任务符号
```

Python（挂载真实 FP-005，调用真实 FP-007）：

```
library/borrow_command.py        BORROWER_MISSING_MESSAGE / parse_borrow_args /
                                 handle_borrow / create_borrow_handler
library/__init__.py              导入时把真实 borrow 处理器挂到 library.cli.dispatcher
```

对外 API：

```ts
// TypeScript
type BorrowExecutor = (bookId: string, borrower: string) => BorrowResult
type BorrowHandler  = (args: readonly string[]) => string
function parseBorrowArgs(args): { bookId, borrower } | null
function handleBorrow(args, execute): string
function createBorrowHandler(store?, execute?): BorrowHandler
function registerBorrowCommand(registrar, store?, execute?): BorrowHandler
```

```python
# Python
BorrowExecutor = Callable[[str, str], BorrowResult]
def parse_borrow_args(args) -> Optional[Tuple[str, str]]
def handle_borrow(args, execute) -> str
def create_borrow_handler(store=None, execute=None) -> Handler
```

## 4. 验证方式

- TypeScript：`npm test`（`tsx --test tests/*.test.ts`）运行
  `tests/borrow-command.test.ts`；`npm run typecheck` 做类型检查。
- Python：`python3 -m unittest discover -s tests` 运行
  `tests/test_borrow_command.py`（含 `python3 -m library borrow ...` 子进程
  冒烟）。
- 用例清单见 `docs/test-cases/FP-006-borrow-command.md`，覆盖任务卡 §7
  三条验收标准与 §8 建议测试（缺参、已借出透传）。
