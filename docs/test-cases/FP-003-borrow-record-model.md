# 测试用例 FP-003：借阅记录数据模型

被测对象：`src/domain/borrow-record.ts` 的纯函数与 `BookStore` 的
`setBorrower` / `clearBorrower`。测试运行器：`node:test`（`tsx` 执行）。
每个用例用 `new BookStore()` 构造隔离集合。

## 用户场景（任务卡 §7 验收标准）

| 编号 | 场景 | Given | When | Then |
|---|---|---|---|---|
| AC-1 | 查看借阅记录 | B001 已借出且 `borrower="u1"` | 读取该图书借阅记录 | `borrower === "u1"` |
| AC-2 | 清除借阅记录（归还） | B001 已借出且 `borrower="u1"` | `clearBorrower('B001')` | `borrower === null` |
| AC-3 | 自由文本原样保存 | 一本图书 | 写入不存在的用户标识 `ghost-user-42` | 原样保存、不校验存在性 |

## 独立验证场景（任务卡 §8）

| 编号 | 场景 | 期望 |
|---|---|---|
| T-1 | 写入借阅人后可读回 | `setBorrower` 后 `find` / `readBorrower` 得同一文本 |
| T-2 | 清除后为 null | `clearBorrower` 后 `borrower === null` |
| T-3 | 不存在标识写入仍原样保存 | `ghost-user-42` 写入后读回一致 |

## 边界与错误路径

| 编号 | 场景 | 期望 |
|---|---|---|
| E-1 | 对不存在编号写入借阅人 | `setBorrower('NOPE', 'u1')` 抛 `BookNotFoundError` |
| E-2 | 对不存在编号清除借阅人 | `clearBorrower('NOPE')` 抛 `BookNotFoundError` |
| E-3 | 覆盖已有借阅人 | 再次 `setBorrower` 后读回为最新值（单册至多一个借阅人） |
| E-4 | 含首尾空白 / 符号的自由文本 | 原样保存，不 `trim`、不改写 |
| E-5 | 对已为 `null` 的借阅记录再次清除 | 幂等，仍为 `null` |
| E-6 | 返回值不可外部篡改 | 修改 `setBorrower` 返回对象的 `borrower`，集合内数据不变 |
| E-7 | 可借且无借阅记录时读取 | 返回 `null` |
| E-8 | 写入 / 清除不改变状态 | 调用 `setBorrower` / `clearBorrower` 后 `status` 与调用前一致 |

### 说明
- 任务卡 §5 明确本任务不做状态流转：E-8 用于固定「只碰 `borrower`
  字段、不碰 `status`」这一边界，状态机由 FP-007 / FP-009 编排。
- AC-3 与 E-4 共同固定「原样保存」：系统不校验借阅人是否存在，
  也不对文本做任何规范化。

## 验收映射
- AC-1 → 用例 `AC-1: reads the borrower recorded on a borrowed book`
- AC-2 → 用例 `AC-2: clearing the record sets the borrower to null`
- AC-3 → 用例 `AC-3: unknown free-text borrower is stored verbatim`
- T-1..T-3、E-1..E-8 见对应用例。

## 运行方式
```
npm test
```
