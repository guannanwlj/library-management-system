# 设计说明 FP-001：图书数据模型与内存存储

> 任务来源：FP-001（源 EN-001 内存数据存储）｜波次 1｜里程碑 M1
> 技术栈：TypeScript（Node.js），任务卡标注「语言无关」，此处为落地选型。

## 1. 目标与范围

定义 `Book` 实体（编号 / 名称 / 状态 / 借阅人）与进程内 `BookStore`
集合，提供「读取全部、按编号查找、更新状态与借阅人」能力，作为后续
借阅、归还、列表展示任务的共享数据底座。

范围外（任务卡 §5）：样例数据载入（FP-002）、借阅/归还业务校验与
状态流转（FP-004/007/009）、命令行入口（FP-005）。因此本模块只做
纯粹的读写，不做业务规则裁决。

## 2. 关键决策

### D1 技术栈：TypeScript + Node 内置 test runner
- 理由：任务卡为「语言无关」，选型需零运行时依赖、可独立验证；
  Node 22 自带 `node:test`，配合 `tsx` 直接运行 TS 测试，无需编译步骤。
- 构建产物不落库（`dist/` 忽略），源码即事实源。

### D2 `Book` 用 `interface` + `BookStatus` 字符串枚举
- `status` 有两个取值：`available`（可借）/ `borrowed`（已借出），
  与任务卡 §3.1 契约一字不差，字符串枚举便于将来序列化/CLI 展示。
- `id`、`title` 只读（`readonly`），`status`、`borrower` 可变。
- `borrower: string | null`，新建默认 `null`。

### D3 `BookStore` 单例 + 可实例化（测试隔离）
- 契约要求「进程内单例集合」。模块导出默认单例 `bookStore`，
  供 FP-002 等下游共享同一份内存数据。
- 同时保留公开构造函数 `new BookStore()`，让单元测试可为每个用例
  构造隔离集合，避免测试间互相污染。单例本质由默认导出保证，
  而非禁止实例化。

### D4 `setStatus` 只写数据，不做业务校验
- 状态机（可借→已借出→可借）的合法性由 FP-004/007/009 裁决，
  本任务不越界。
- 唯一的数据不变式：`status === available` 时 `borrower` 归一化为
  `null`（契约「仅 borrowed 时非空」）。这是字段级约束，不是业务流。
- `setStatus` 对不存在的 `id` 抛 `BookNotFoundError`：静默失败会让
  调用方误以为更新成功，显式报错更安全；存在性判断属于数据层。

### D5 返回防御性副本
- `listAll` / `find` 返回 `Book` 的浅拷贝，防止调用方绕过 `setStatus`
  直接改字段，保证「更新必须经集合」这一约定。
- 插入顺序由 `Map` 保持，`listAll` 输出顺序稳定（利于列表展示）。

### D6 `add` 拒绝重复编号
- 契约要求 `id` 唯一、非空。重复 `add` 抛 `DuplicateBookIdError`。
- 另提供 `create(id, title)` 便捷构造，默认 `available` / `borrower=null`，
  供 FP-002 种子数据使用。

## 3. 模块结构

```
src/
  domain/book.ts        Book 接口、BookStatus 枚举、createBook 工厂、错误类型
  store/book-store.ts   BookStore 类、bookStore 单例
  index.ts              对外桶导出（含 bookStore）
tests/
  book-store.test.ts    单元测试（node:test）
```

对外 API（供下游任务引用）：

```ts
enum BookStatus { Available = 'available', Borrowed = 'borrowed' }
interface Book { readonly id: string; readonly title: string; status: BookStatus; borrower: string | null }

class BookStore {
  add(book: Book): Book
  create(id: string, title: string): Book
  listAll(): Book[]
  find(id: string): Book | undefined
  setStatus(id: string, status: BookStatus, borrower?: string | null): Book
  clear(): void            // 测试/重置用
}
const bookStore: BookStore  // 进程内单例
```

## 4. 验证方式

`npm test`：运行 `tsx --test tests/*.test.ts`，覆盖任务卡 §7 三条验收
标准 + §8 建议测试（空集合、写入可查、更新一致）+ 边界与错误路径。
测试用例清单见 `docs/test-cases/FP-001-book-model-inmemory.md`。
