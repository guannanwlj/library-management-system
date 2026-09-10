# 设计说明 FP-009：归还执行与状态恢复

> 任务来源：FP-009（源 UC-002 归还图书 ｜ 业务规则与计算）｜优先级 P1｜
> 里程碑 M2｜并发波次 3
> 强依赖：FP-001 图书数据模型与内存存储、FP-003 借阅记录数据模型、
> FP-004 借阅状态规则与错误反馈
> 技术栈：语言无关（本仓库实际为 TypeScript + Python 双栈，见 §2）。

## 1. 目标与范围

一次真实的归还执行：按 `bookId` 查找图书，调用 FP-004 的归还规则判定，
合法时把状态恢复为 `available`、清除借阅记录（`borrower = null`）并返回
成功；非法时返回 FP-004 的固定错误文案且不改变任何状态。

范围外（任务卡 §5）：命令行参数解析与结果输出（FP-008）、规则判定本身
（FP-004）、借出与列表（FP-006 / FP-007 / FP-010）。

## 2. 关键决策

### D1 双栈实现，对齐上下游运行时
本仓库两个上游运行时并存：

- FP-001 / FP-003 / FP-004 为 **TypeScript**（`src/store/book-store.ts`、
  `src/domain/borrow-record.ts`、`src/rules/borrow-rules.ts`），
  可直接复用，无需按 §6 走 Mock。
- 命令行入口 FP-005 及将要调用本任务的 FP-008 为 **Python**
  （`library/cli.py`）。Python 进程无法 import TypeScript，故按 §6
  「内联最小 BookStore + 内联规则函数」提供一份薄执行层。

因此本任务在两处落一份等价执行逻辑，共享同一行为契约（§3）：

- TS：`src/features/return-book.ts`，消费真实 FP-001 的 `find` /
  `setStatus`、FP-003 的「归还即 `borrower = null`」约定、FP-004 的
  `checkReturn` 判定与文案。
- PY：`library/return_book.py`，复用 FP-010 引入的 §6 兜底
  `library/book_store.py`，并内联最小归还规则判定。

### D2 判定与执行分离：只调用 FP-004 的结论
执行层不重新实现规则，只调用 FP-004 的 `checkReturn(store, id)`：

- `allowed: false` → 原样返回 `{ ok: false, message }`，**不触碰状态**。
- `allowed: true`  → 执行状态变更，返回 `{ ok: true, message: 成功文案 }`。

拒绝路径天然幂等且无副作用；成功路径唯一写入点为一次 `setStatus`。

### D3 状态恢复用 `setStatus(id, available)`
`available` 时借阅人恒为 `null`（FP-001 的 `normalizeBorrower` 数据不变式，
同时满足 FP-003 的清除约定），故一次 `setStatus` 同时完成「状态恢复」与
「清除借阅记录」，不需要先 `clearBorrower` 再置状态。

### D4 归还人不做一致性校验
归还人不入参：`returnBook` 只接收 `bookId`，D3 的自由文本借阅人不会参与
任何比较。因此记录里的 `u1` 不会阻碍任何人归还，归还成功后一律清空。

### D5 对外契约与可测试性
任务卡契约 `returnBook(bookId) -> { ok, message }`。为忠实于该签名，
`bookId` 为首参，`store` 作为**可选末位参数**注入（默认进程内单例
`bookStore`）：

```ts
returnBook(bookId: string, store?: BookStore): ReturnResult
return_book(book_id: str, store: Optional[BookStore] = None) -> ReturnResult
```

生产调用（FP-008）只需 `returnBook(bookId)`；测试传隔离集合，避免污染
单例。

### D6 成功文案
任务卡只固定拒绝文案（复用 FP-004），未规定成功文案。成功时返回
常量 `RETURN_SUCCESS_MESSAGE = '归还成功'`，供 FP-008 直接打印。

## 3. 模块结构

```
src/features/return-book.ts   RETURN_SUCCESS_MESSAGE / ReturnResult / returnBook
tests/return-book.test.ts     node:test 单元测试

library/return_book.py        RETURN_SUCCESS_MESSAGE / 错误文案 / ReturnResult / return_book
tests/test_return_book.py     unittest 单元测试
```

对外 API：

```ts
// TypeScript
const RETURN_SUCCESS_MESSAGE = '归还成功'
interface ReturnResult { readonly ok: boolean; readonly message: string }
returnBook(bookId: string, store?: BookStore): ReturnResult
```

```python
# Python
RETURN_SUCCESS_MESSAGE = "归还成功"
@dataclass(frozen=True)
class ReturnResult:
    ok: bool
    message: str
def return_book(book_id: str, store: Optional[BookStore] = None) -> ReturnResult
```

## 4. 验证方式

- TypeScript：`npm test`（`tsx --test tests/*.test.ts`）运行
  `tests/return-book.test.ts`；`npm run typecheck` 做类型检查。
- Python：`python3 -m unittest discover -s tests -v` 运行
  `tests/test_return_book.py`。
- 用例清单见 `docs/test-cases/FP-009-return-execution.md`。
