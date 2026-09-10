# 设计说明 FP-004：借阅状态规则与错误反馈

> 任务来源：FP-004（源 EN-004 借阅状态规则与错误反馈 ｜ 业务规则与计算）
> ｜优先级 P0｜里程碑 M1｜并发波次 2
> 强依赖：FP-001 图书数据模型与内存存储（读取图书当前状态）
> 技术栈：任务卡标注「语言无关」，此处落地为 TypeScript，与 FP-001 保持一致。

## 1. 目标与范围

把「什么操作合法、不合法时提示什么」集中成一处规则，供借出执行
（FP-007）与归还执行（FP-009）调用，避免规则散落。本任务**只做判定**：

- 要做：输入「操作类型（借阅 / 归还）＋ 图书查找结果 ＋ 当前状态 ＋
  借阅人标识」，输出「允许 / 拒绝 ＋ 错误文案」。
- 不做：实际状态变更（FP-007 / FP-009）、命令行参数解析与输出
  （FP-006 / FP-008）、`Book` 实体与集合本身（FP-001）。

## 2. 关键决策

### D1 实现语言：TypeScript（复用 FP-001）
任务卡为「语言无关」。FP-001 已用 TypeScript 落地 `Book` / `BookStatus`
/ `BookStore.find(id)`，本任务直接复用该契约，不另造一份状态模型，
也无需按 §6 走 Mock。规则模块纯逻辑、无副作用，若将来需要从其他
语言（如 Python CLI）调用，可通过进程边界桥接，规则本身不动。

### D2 判定与执行分离：纯函数，绝不改状态
`checkBorrowRules` 只读取传入的图书快照（`status` / `borrower`），
不做任何写入，也不持有集合引用。拒绝时状态与借阅记录天然不变。
调用方（FP-007 / FP-009）在得到 `allowed: true` 后再自行执行
`setStatus`。

### D3 输入取「查找结果」而非集合：便于独立验证
任务卡 §4 定义输入含「图书查找结果」，§6 允许用最简状态对象验证。
故核心函数接受一个结构化的最简图书视图
`RuleBook = Pick<Book, 'status' | 'borrower'>`，完整 `Book` 天然满足。
另提供两个便捷包装 `checkBorrow` / `checkReturn`，接收
`BookLookup`（结构上即 `BookStore.find`）并按 §3.2 读取状态，满足
「本任务按此调用」的集成口径。

### D4 错误文案集中为常量
四类拒绝文案一字不差地收敛到 `BorrowRuleMessages`，类型
`BorrowRuleMessage` 由常量推导，避免各处手写字符串。

### D5 判定优先级
统一顺序：**存在性 → 状态 → 借阅人标识**。

- 编号不存在时，无论是借阅还是归还，一律先返回「图书不存在」，
  不再追究其他条件。
- 借阅已借出图书时，先返回「该图书已借出」；即便同时缺借阅人标识，
  也以状态冲突为准（已借出无法再借）。
- 仅当图书可借且操作是借阅时，才检查借阅人标识是否缺失。

### D6 允许结果不带文案
任务卡只固定四类**拒绝**文案，未规定成功文案（成功文案属于
FP-007 / FP-009 的输出职责）。故允许结果 `message` 为 `null`，
用可辨识联合 `{ allowed: true; message: null }` 表达，类型上强制
调用方先判 `allowed` 再取错误文案。

### D7 借阅人标识「缺失」口径
空、纯空白、`null`、`undefined` 均视为缺失（用户拍板「强制必填，
缺失即拒绝」）。归一化只在判定内部做，不改动调用方数据。

## 3. 模块结构

```
src/
  rules/borrow-rules.ts   操作枚举、文案常量、判定函数与查询包装
tests/
  borrow-rules.test.ts    node:test 单元测试
```

对外 API（供 FP-007 / FP-009 引用）：

```ts
enum BorrowOperation { Borrow = 'borrow', Return = 'return' }

const BorrowRuleMessages = {
  BookNotFound:    '图书不存在',
  AlreadyBorrowed: '该图书已借出',
  NotBorrowed:     '该图书未借出',
  BorrowerMissing: '借阅人标识缺失',
}

type RuleBook = Pick<Book, 'status' | 'borrower'>

type BorrowRuleDecision =
  | { allowed: true;  message: null }
  | { allowed: false; message: BorrowRuleMessage }

checkBorrowRules(input: {
  operation: BorrowOperation
  book: RuleBook | undefined
  borrower?: string | null
}): BorrowRuleDecision

// 便捷包装：内部调用 store.find(id)
checkBorrow(store: BookLookup, id, borrower): BorrowRuleDecision
checkReturn(store: BookLookup, id): BorrowRuleDecision
```

## 4. 验证方式

`npm test`（`tsx --test tests/*.test.ts`）覆盖任务卡 §7 四条验收标准
与 §8 建议测试，并补充允许路径、判定优先级与「拒绝后状态不变」。
用例清单见 `docs/test-cases/FP-004-borrow-rules-errors.md`。
