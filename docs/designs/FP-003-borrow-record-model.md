# 设计说明 FP-003：借阅记录数据模型

> 任务来源：FP-003（源 EN-005 借阅记录（图书 + 借阅人））｜波次 2｜里程碑 M1
> 技术栈：TypeScript（Node.js），与强依赖 FP-001 保持同一实现栈。

## 1. 目标与范围

把「谁借了这本书」的记录方式落成明确的字段级契约：借阅关系**附着在
`Book` 实体上**（`borrower`，`string | null`），不单独建借阅记录表
（D4 单册模型）。本任务提供「写入借阅人」与「清除借阅人」两个能力，
借阅人一律**原样保存**，不做存在性校验（D3 自由文本）。

范围外（任务卡 §5）：
- 借出 / 归还的**状态流转与业务校验**由 FP-007 / FP-009 负责；
  本任务只碰 `borrower` 字段，不碰 `status`。
- 借阅合法性判定与错误文案由 FP-004 负责。
- 命令行入口由 FP-005 负责。

## 2. 与 FP-001 的关系（集成点 I-02）

FP-001 已实现 `Book`（含 `borrower`）与 `BookStore.find` / `setStatus`，
故本任务按任务卡 §3.2 **直接调用真实现**，不再内联 Mock（§6 的
「未实现时 Mock」条件不成立）。

FP-001 的 `setStatus` 已能同时写状态与借阅人，但它把两件事绑在一起；
FP-003 的职责是把「借阅人字段本身」独立出来，作为 §3.1 契约的源头，
供 FP-007（写入约定，I-07）与 FP-009（清除约定，I-12）消费。因此：

- 复用 `Book` 类型与 `BookStore` 集合，不重复定义实体。
- 新增**只改动 `borrower`、绝不改动 `status`** 的字段级原语。

## 3. 关键决策

### D1 新增领域模块 `domain/borrow-record.ts`
`borrower` 的读写约定集中在此模块，导出纯函数：

```ts
type Borrower = string | null

function readBorrower(book: Book): Borrower          // 读取借阅记录
function withBorrower(book: Book, borrower: string): Book   // 写入（不校验存在性）
function withoutBorrower(book: Book): Book                  // 清除（归还）
```

- 纯函数返回**新的 `Book`**（浅拷贝），不改入参，避免调用方绕过集合
  直接改共享对象；与 FP-001「更新必须经集合」的防御性副本约定一致。
- `withBorrower` **不调用 `normalizeBorrower`**：任务要求借阅人原样保存，
  借阅人的合法性（非空等）属 FP-004 的规则层，本任务不越界。
- 空串、含首尾空白、符号等一切自由文本都原样保留，不做 `trim`。

### D2 `BookStore` 增加集合级能力
集合读写仍由 FP-001 的 `BookStore` 承载（不另建借阅表）。新增两个方法
委托到 D1 的纯函数，保证「先 `find` 再改」的原子性与一致性：

```ts
setBorrower(id: string, borrower: string): Book   // 写入借阅人
clearBorrower(id: string): Book                   // 清除借阅人
```

- 编号不存在时抛 `BookNotFoundError`（复用 FP-001 错误类型，静默失败
  会让调用方误以为写入成功）。
- 返回防御性副本。

### D3 明确不流转状态
`setBorrower` **不改 `status`**，`clearBorrower` 同理。这是任务卡 §5 的
硬边界：状态机由 FP-007 / FP-009 编排。因此对一本 `available` 图书
调用 `setBorrower` 会得到 `available + borrower` 的中间态——这是存在的，
但**不是借出**；FP-007 会在同一次借出里把 `status` 置为 `borrowed`。
本任务用测试固定「调用后 `status` 不变」以证明没有越界。

## 4. 模块结构

```
src/
  domain/borrow-record.ts   借款人类型 + 读取/写入/清除纯函数（本任务新增）
  domain/book.ts            Book / BookStatus（FP-001）
  store/book-store.ts       BookStore + setBorrower / clearBorrower（本任务扩展）
  index.ts                  对外桶导出（补充本任务符号）
tests/
  borrow-record.test.ts     单元测试（node:test）
docs/
  designs/FP-003-borrow-record-model.md
  test-cases/FP-003-borrow-record-model.md
```

对外 API（供 FP-007 / FP-009 消费）：

```ts
type Borrower = string | null
readBorrower(book: Book): Borrower
withBorrower(book: Book, borrower: string): Book
withoutBorrower(book: Book): Book

class BookStore {
  setBorrower(id: string, borrower: string): Book  // 不存在则抛 BookNotFoundError
  clearBorrower(id: string): Book
}
```

## 5. 数据契约

| 字段 | 类型 | 写入规则 |
|---|---|---|
| `borrower` | `string \| null` | 借出时＝借阅人标识（原样）；归还时＝`null` |

不单独建借阅记录表；一本图书同时至多一个借阅人（D4 单册模型）。

## 6. 验证方式

`npm test`（`tsx --test tests/*.test.ts`）覆盖任务卡 §7 三条验收标准
（读取、清除、自由文本原样保存）与 §8 建议测试（写入可读回、清除为
null、不存在标识原样保存），并补充边界与错误路径。用例清单见
`docs/test-cases/FP-003-borrow-record-model.md`。
