# 设计说明 FP-002：样例图书初始化

> 任务来源：FP-002（源 EN-002 样例数据初始化）｜波次 2｜里程碑 M1
> 强依赖：FP-001 图书数据模型与内存存储（Book 实体 + BookStore）
> 技术栈：TypeScript（Node.js），与 FP-001 保持一致。

## 1. 目标与范围

系统启动时把一组固定的样例图书写入内存集合，使系统开箱即有数据
可操作，且初始状态全部为可借（`available`、`borrower` 为 `null`）。

范围外（任务卡 §5）：Book 实体与 BookStore 实现（FP-001，本任务按
§3.2 契约调用）、借阅/归还业务规则（FP-004）、命令行入口（FP-005）。

## 2. 关键决策

### D1 复用 FP-001 的内存集合，不另建存储
FP-001 已实现 `BookStore`（含 `add` / `create`）与进程内单例
`bookStore`。本任务只负责「种子清单 + 启动写入」，数据仍落在同一个
`Map` 集合里，下游任务共享同一份内存数据。

### D2 种子清单作为显式常量导出
```ts
export const SAMPLE_BOOKS: readonly SampleBook[] = Object.freeze([
  { id: 'B001', title: '三体' },
  { id: 'B002', title: '活着' },
  { id: 'B003', title: '百年孤独' },
])
```
清单即任务卡 §3.1 的初始化输入契约，集中一处便于复核与下游引用；
用 `Object.freeze` + `readonly` 保护，避免被调用方就地修改。
只保留 `id` / `title`；状态与借阅人由 FP-001 的默认值给出
（`available` / `null`），避免在种子层重复声明冗余字段。

### D3 初始化函数接受 BookStore 参数，默认单例
```ts
export function initializeSampleBooks(store: BookStore = bookStore): Book[]
```
默认写入进程内单例（即「系统启动」语义）；显式传入 `BookStore` 则
可让单元测试使用隔离集合，避免污染共享状态，也便于将来替换实现。

### D4 幂等：只补缺失的样例，不覆盖已有状态
初始化对每个样例先 `find(id)`，已存在则跳过，否则用 `store.create`
写入。这样启动初始化可安全重复执行（例如测试多次调用），且不会把
运行期已借出的样例重置回可借。返回本次实际新增的图书列表。
`find` 是 §3.2 契约方法；写入用 `create`（`add` + 默认值），语义清晰。

### D5 状态来源唯一
初始状态不需额外赋值：`BookStore.create` 已保证新建图书
`status = available`、`borrower = null`（FP-001 D6 / N-1）。本任务不
调用 `setStatus`，避免无谓的状态变更。

## 3. 模块结构

```
src/
  data/sample-books.ts   SAMPLE_BOOKS 清单、initializeSampleBooks
  index.ts               对外桶导出（追加样例初始化 API）
tests/
  sample-books.test.ts   单元测试（node:test）
```

对外 API（供 FP-005 启动流程调用）：

```ts
interface SampleBook { readonly id: string; readonly title: string }
const SAMPLE_BOOKS: readonly SampleBook[]
function initializeSampleBooks(store?: BookStore): Book[]
```

## 4. 验证方式

`npm test`：运行 `tsx --test tests/*.test.ts`，覆盖任务卡 §7 两条验收
标准 + §8 建议测试（集合大小＝3、逐本状态为 `available`）以及幂等、
默认单例、清单不可变等边界。用例清单见
`docs/test-cases/FP-002-sample-books-init.md`。
