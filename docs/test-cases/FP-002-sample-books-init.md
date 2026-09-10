# 测试用例 FP-002：样例图书初始化

被测对象：`src/data/sample-books.ts` 的 `SAMPLE_BOOKS` 与
`initializeSampleBooks(store?)`。
测试运行器：`node:test`（通过 `tsx` 执行 TypeScript）。
除单例用例外，每个用例使用 `new BookStore()` 构造隔离集合。

## 用户场景（任务卡 §7 验收标准）

| 编号 | 场景 | Given | When | Then |
|---|---|---|---|---|
| AC-1 | 启动写入样例 | 空的内存图书集合 | `initializeSampleBooks(store)` | 集合中存在 B001《三体》、B002《活着》、B003《百年孤独》，`status` 均 `available`、`borrower` 为 `null` |
| AC-2 | 读取样例编号与名称 | 初始化完成 | `find(id)` 逐本读取 | 可读到正确编号与名称 |

## 独立验证场景（任务卡 §8）

| 编号 | 场景 | 期望 |
|---|---|---|
| T-1 | 集合大小 | 初始化后 `listAll().length === 3` |
| T-2 | 逐本状态 | 三本 `status === available`、`borrower === null` |
| T-3 | 清单内容契约 | `SAMPLE_BOOKS` 恰为 B001/B002/B003 |

## 边界与错误路径

| 编号 | 场景 | 期望 |
|---|---|---|
| E-1 | 初始化可重复执行 | 连续调用两次不抛错，集合仍为 3 本 |
| E-2 | 已存在的样例不被覆盖 | 预先将 B001 置为 `borrowed u1`，初始化后其状态与借阅人保持为 `borrowed` / `u1` |
| E-3 | 部分已存在 | 预置 B002 后初始化，只补 B001/B003，总数仍为 3 |
| E-4 | 返回值 | 首次返回新增的 3 本；再次调用返回空数组 |
| E-5 | 清单不可变 | `Object.isFrozen(SAMPLE_BOOKS)` 为真，且修改元素不生效 |
| E-6 | 默认写入单例 | 不带参数调用后，`bookStore` 内可查到样例，测试后清理 |

## 验收映射
- AC-1、T-1、T-2 → 用例 `AC-1: seeds the three sample books as available`
- AC-2 → 用例 `AC-2: sample books expose their id and title`
- E-1..E-6 见对应用例。
