# 测试用例 FP-001：图书数据模型与内存存储

测试运行器：`node:test`（通过 `tsx` 执行 TypeScript）。
每个用例使用 `new BookStore()` 构造隔离集合。

## 用户场景（任务卡 §7 验收标准）

| 编号 | 场景 | Given | When | Then |
|---|---|---|---|---|
| AC-1 | 读取全部图书 | 集合含 {B001 可借, B002 可借} | `listAll()` | 返回这 2 本图书 |
| AC-2 | 更新状态与借阅人 | 集合含 B001 | `setStatus('B001', borrowed, 'u1')` | 再次 `find('B001')` 得 `status=borrowed`、`borrower='u1'` |
| AC-3 | 同一进程内读取一致 | B001 状态已更新 | 再次读取（`find` / `listAll`） | 状态保持一致，不被重置 |

## 独立验证场景（任务卡 §8）

| 编号 | 场景 | 期望 |
|---|---|---|
| T-1 | 空集合读取 | `listAll()` 返回空数组 |
| T-2 | 写入后可查 | `add` 后 `find(id)` 返回该图书 |
| T-3 | 状态更新后再次读取一致 | 连续两次读取结果相同，且为更新后的值 |
| T-4 | 新建图书默认值 | `create` 的图书 `status=available`、`borrower=null` |

## 边界与错误路径

| 编号 | 场景 | 期望 |
|---|---|---|
| E-1 | 查找不存在的编号 | `find('NOPE')` 返回 `undefined` |
| E-2 | 更新不存在的编号 | `setStatus('NOPE', borrowed, 'u1')` 抛 `BookNotFoundError` |
| E-3 | 重复编号入库 | `add` 相同 `id` 抛 `DuplicateBookIdError` |
| E-4 | 空编号入库 | `add` / `create` 传入空/纯空白编号，抛 `InvalidBookError` |
| E-5 | 归还后清除借阅人 | `setStatus('B001', available, 'u1')` 后 `borrower` 归一化为 `null` |
| E-6 | 返回值不可外部篡改 | 修改 `find` 返回对象的字段，集合内数据不变 |
| E-7 | `listAll` 顺序稳定 | 按插入顺序返回 |

### E-4 说明
契约「id 唯一、非空」。本任务对空/纯空白 `id` 抛
`InvalidBookError`（数据层校验，非业务校验）。故新增错误类型
`InvalidBookError`，与 `BookNotFoundError`、`DuplicateBookIdError`
一并由 `domain/book.ts` 导出。

## 数据不变式与归一化

| 编号 | 场景 | 期望 |
|---|---|---|
| N-1 | 可借图书携带遗留借阅人入库 | 借阅人归一化为 `null`（读回同样为 `null`） |
| N-2 | 已借出图书携带借阅人入库 | 状态与借阅人跨多次读取保持一致 |
| N-3 | 入库时编号/名称含首尾空白 | 存储为去除首尾空白后的值 |
| N-4 | 空/纯空白名称入库 | 抛 `InvalidBookError` |
| N-5 | 清空集合 | `listAll()` 为空，`find` 返回 `undefined` |

## 验收映射
- AC-1 → 用例 `listAll returns seeded books`
- AC-2 → 用例 `setStatus updates status and borrower`
- AC-3 → 用例 `status persists across reads`
- E-1..E-7、N-1..N-5 见对应用例。
