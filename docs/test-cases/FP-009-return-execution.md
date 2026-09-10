# 测试用例 FP-009：归还执行与状态恢复

被测对象：
- TypeScript：`src/features/return-book.ts`（消费真实 FP-001 `BookStore`、
  FP-003 清除约定、FP-004 `checkReturn` 判定）。
- Python：`library/return_book.py`（复用 §6 兜底 `library/book_store.py`，
  内联最小归还规则）。

运行方式：
- TS：`npm test`
- PY：`python3 -m unittest discover -s tests -v`

种子数据（任务卡 §6）：B002 已借出（`borrower="u1"`）；B001 可借；
B999 不存在。

## 用户场景（任务卡 §7 验收标准）

| 编号 | 场景 | Given | When | Then |
|---|---|---|---|---|
| AC-1 | 已借出图书归还 | B002 已借出（borrower `u1`） | 归还 B002 | `ok=true`，B002 `status=available`、`borrower=null` |
| AC-2 | 归还未借出图书 | B001 可借 | 归还 B001 | `ok=false`，文案「该图书未借出」，B001 状态不变 |
| AC-3 | 归还编号不存在 | B999 不存在 | 归还 B999 | `ok=false`，文案「图书不存在」 |
| AC-4 | 归还人不校验一致性 | B002 已借出（borrower `u1`） | 以任意归还人归还 | 不比对 `u1`，直接 `ok=true`，`borrower=null` |

## 独立验证场景（任务卡 §8）

| 编号 | 场景 | 期望 |
|---|---|---|
| T-1 | 成功结果结构 | 返回 `{ ok: true, message: '归还成功' }` |
| T-2 | 失败结果结构 | 返回 `ok=false` 且 `message` 为对应固定文案，非空 |
| T-3 | 归还后列表可见 | 归还成功后 `listAll()` 中该书记录为 `available` / `null` |
| T-4 | 连续归还 | 已归还图书再次归还 → 「该图书未借出」 |
| T-5 | 不影响其他图书 | 归还 B002 不改变 B001 的状态与借阅记录 |

## 边界与错误路径

| 编号 | 场景 | 期望 |
|---|---|---|
| E-1 | 可借图书归还 | 拒绝「该图书未借出」，状态与借阅人保持原样 |
| E-2 | 编号不存在 | 拒绝「图书不存在」，集合不新增记录 |
| E-3 | 空 / 纯空白编号 | 视为不存在，拒绝「图书不存在」 |
| E-4 | 拒绝路径零副作用 | 多次失败调用后 `listAll()` 深等于调用前 |
| E-5 | 携带残留借阅人的可借图书 | 状态为 `available` 即拒绝，不看 `borrower` |
| E-6 | 默认使用进程内单例 | 不传 `store` 时读写共享集合（测试自行清理） |

## 文案逐字校验

拒绝文案必须逐字等于 FP-004 契约固定值：`图书不存在`、`该图书未借出`；
成功文案为常量 `归还成功`。

## 验收映射
- AC-1 → TS `returns a borrowed book and clears its borrower` / PY `test_ac1_...`
- AC-2 → `rejects returning an available book without changing state`
- AC-3 → `rejects an unknown book id`
- AC-4 → `does not compare the returner with the recorded borrower`
- T-1..T-5、E-1..E-6 见对应用例。
