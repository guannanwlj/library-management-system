# 测试用例 FP-008：归还命令入口

被测对象：
- TypeScript：`src/features/return-command.ts`（消费真实 FP-009
  `returnBook(bookId)`；注册面按 FP-005 §3.2 形状对齐）。
- Python：`library/return_command.py`（挂载真实 FP-005 `library.cli`
  分发器；复用 PY 侧 FP-009 `library/return_book.py`）。

运行方式：
- TS：`npm test`
- PY：`python3 -m unittest discover -s tests -v`

种子数据（任务卡 §6）：B002 已借出（`borrower="u1"`）；B001 可借；
B999 不存在。

## 用户场景（任务卡 §7 验收标准）

| 编号 | 场景 | Given | When | Then |
|---|---|---|---|---|
| AC-1 | 归还已借出图书 | B002 已借出 | 输入 `return B002` | 触发归还执行，输出「归还成功」，B002 恢复可借且清除借阅人 |
| AC-2 | 归还可借图书 | B001 可借 | 输入 `return B001` | 透传拒绝文案「该图书未借出」，B001 状态不变 |
| AC-3 | 归还不存在图书 | B999 不存在 | 输入 `return B999` | 输出「图书不存在」 |

## 参数解析

| 编号 | 场景 | 期望 |
|---|---|---|
| P-1 | 取第一个 token 作编号 | `parseReturnBookId(['B002'])` / `parse_book_id(['B002'])` 返回 `B002` |
| P-2 | 缺失参数（空 args） | 视为空串，经归还执行输出「图书不存在」 |
| P-3 | 多余参数 | 只用第一个 token，其余忽略，不报错 |

## 结果透传与输出

| 编号 | 场景 | 期望 |
|---|---|---|
| O-1 | 成功 | 处理器返回 `归还成功` |
| O-2 | 可借 | 处理器返回 `该图书未借出` |
| O-3 | 不存在 | 处理器返回 `图书不存在` |
| O-4 | 连续调用 | 第一次成功、第二次对同一编号返回「该图书未借出」 |
| O-5 | 结果即 FP-009 文案 | 处理器返回值逐字等于 `returnBook(...).message` |

## 分发与集成

| 编号 | 场景 | 期望 |
|---|---|---|
| I-1 (TS) | 注册到分发面 | `registerReturnCommand(registrar, store)` 后 `registrar` 收到名字 `return` 与处理器 |
| I-2 (TS) | 处理器读取注入集合 | 处理器输出等于对该集合调用归还执行的结果文案 |
| I-3 (PY) | 覆盖 FP-005 占位 | `library.cli.dispatch(["return", "B001"])` 返回真实文案（不再是「命令已受理」） |
| I-4 (PY) | 统一输出 | `library.cli.run(["return", "B999"], out=StringIO)` 写入并返回文本 |
| I-5 (PY) | 默认单例 | 不传 store 时读写共享集合（测试自行清理） |
| I-6 (PY) | CLI 冒烟 | `python3 -m library return B999` 退出码 0 且 stdout 为「图书不存在」 |

## 边界与错误路径

| 编号 | 场景 | 期望 |
|---|---|---|
| E-1 | 空参数列表 | 输出「图书不存在」，集合不变 |
| E-2 | 空 / 纯空白编号 | 输出「图书不存在」 |
| E-3 | 多余参数 | 与仅传一个参数结果一致 |
| E-4 | 失败路径零副作用 | 多次失败调用后集合深等于调用前 |
| E-5 | 入口不改状态 | 可借图书归还失败后状态与借阅人保持原样 |

## 验收映射

- AC-1 → TS `AC-1` / PY `test_ac1_returning_a_borrowed_book_reports_success`
- AC-2 → `AC-2`
- AC-3 → `AC-3`
- I-1/I-2 → TS `分发与集成`
- I-3/I-4/I-6 → PY `DispatcherIntegrationTests` / `StartupTests`
