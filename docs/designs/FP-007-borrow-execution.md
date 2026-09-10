# 设计说明 FP-007：借出执行与状态变更

> 任务来源：FP-007（源 UC-001 借阅图书 ｜ 业务规则与计算）｜
> 优先级 P1｜里程碑 M2｜并发波次 3
> 强依赖：FP-001 图书数据模型与内存存储、FP-003 借阅记录数据模型、
> FP-004 借阅状态规则与错误反馈（三者均已实现）
> 技术栈：语言无关（本仓库实际为 TypeScript + Python 双栈，见 §2）。

## 1. 目标与范围

借阅主流程的核心执行：按编号查找图书 → 调用 FP-004 规则判定 → 合法时
把 `status` 置为 `borrowed`、`borrower` 置为入参并返回成功；非法时返回
固定错误文案，且**不改变状态与借阅记录**。

范围外（任务卡 §5）：
- 命令行参数解析与结果输出（FP-006 借阅命令入口）。
- 规则判定本身（FP-004），本任务只调用其结论。
- 归还与列表（FP-008 / FP-009 / FP-010）。

## 2. 关键决策

### D1 直接复用真实现，不再 Mock（§6 条件不成立）
三个强依赖在本仓库均已落地且为 TypeScript：

- FP-001 → `BookStore.find` / `BookStore.setStatus`（`src/store/book-store.ts`）。
- FP-003 → `borrower` 字段写入约定（`src/domain/borrow-record.ts`，`setStatus`
  内部经 `normalizeBorrower` 落地）。
- FP-004 → `checkBorrowRules` / `BorrowRuleMessages`（`src/rules/borrow-rules.ts`）。

因此本任务按 §3.2 直接调用真实现，不需要 §6 的内联 Mock。

### D2 TS 侧新增特性模块 `features/borrow-book.ts`
沿用 `features/list-books.ts` 的分层：特性模块负责「编排」，领域规则
（FP-004）与集合（FP-001）保持纯粹。对外执行契约对齐任务卡 §3.2：

```ts
interface BorrowResult { readonly ok: boolean; readonly message: string }

borrow(bookId, borrower, store?): BorrowResult
```

- 判定与执行分离：先 `checkBorrowRules`，`allowed` 为假立即返回
  `{ ok: false, message }`，**不触碰集合**；为真才 `setStatus(...)`。
  真正实现「非法操作被拒绝且状态与借阅记录不变」。
- 状态与借阅人一次写入：调用 `BookStore.setStatus(bookId, Borrowed, borrower)`，
  该调用同时流转状态与写入借阅人，避免中间态（FP-003 D3 的边界）。
- `borrower` 原样保存：FP-003 规定自由文本原样写入，故不在本任务
  `trim`；合法性（空 / 纯空白拒绝）已由 FP-004 判定。

### D3 默认集合注入，契约签名保持 `borrow(bookId, borrower)`
`store` 作为可选的第三参数，默认进程内单例 `bookStore`。这样对 FP-006
暴露的字面签名就是任务卡要求的 `borrow(bookId, borrower)`，同时测试可
传入隔离的 `BookStore`，不污染共享状态。

### D4 成功文案
任务卡只固定四类**拒绝**文案，未规定成功文案。本任务把成功文案收敛为
常量 `BORROW_SUCCESS_MESSAGE = '借阅成功'`，`ok` 为成功与否的唯一判据，
FP-006 可自行决定最终输出格式。

### D5 Python 侧镜像实现（双栈，与 FP-010 同理）
FP-005 设计说明明确把 FP-006 / FP-007 / FP-008 / FP-009 归入 Python
`library` 包的「子命令真实业务逻辑」。为让将来的 Python 版 FP-006
借阅命令入口能直接调用，本任务在 Python 侧提供等价的
`library/borrow_books.py`：

- 复用 FP-010 的 §6 兜底 `library/book_store.py`（`find` / `set_status`），
  FP-001 的 Python 实现出现后可直接替换。
- FP-004 无 Python 实现，按 §6 以内联最小规则函数替代；规则口径与
  TS 版逐字一致（存在性 → 状态 → 借阅人标识），固定文案四字不差。
- 两个运行时共享同一份**结果契约**（`ok` / `message`）与文案，故对外
  行为一致；复制的是适配运行时的薄逻辑，而非业务规则本身。

## 3. 模块结构

```
src/features/borrow-book.ts     BORROW_SUCCESS_MESSAGE / BorrowResult / borrow（新增）
src/index.ts                    对外桶导出补充本任务符号
library/borrow_books.py         同日 Python 实现（新增）
tests/borrow-execution.test.ts  TS 单元测试（node:test）
tests/test_borrow_books.py      Python 单元测试（unittest）
```

对外 API：

```ts
// TypeScript
const BORROW_SUCCESS_MESSAGE: '借阅成功'
interface BorrowResult { ok: boolean; message: string }
function borrow(bookId, borrower, store?): BorrowResult
```

```python
# Python
BORROW_SUCCESS_MESSAGE: str
class BorrowResult:  # dataclass: ok / message
def borrow(book_id, borrower, store=None) -> BorrowResult
```

## 4. 验证方式

- TypeScript：`npm test`（`tsx --test tests/*.test.ts`）运行
  `tests/borrow-execution.test.ts`；`npm run typecheck` 做类型检查。
- Python：`python3 -m unittest discover -s tests` 运行
  `tests/test_borrow_books.py`。
- 用例清单见 `docs/test-cases/FP-007-borrow-execution.md`，覆盖任务卡
  §7 四条验收标准与 §8 建议测试（成功断言状态与借阅人；三类失败断言
  文案与状态不变）。
