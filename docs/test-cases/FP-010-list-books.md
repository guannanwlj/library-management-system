# 测试用例 FP-010：图书列表查询与展示

被测对象：
- TypeScript：`src/features/list-books.ts`（消费真实 FP-001 `BookStore.listAll()`）。
- Python：`library/list_books.py`（挂载真实 FP-005 `library.cli` 分发器；
  数据源为 §6 最小兜底 `library/book_store.py`）。

术语：样例集合＝B001《三体》/ B002《活着》/ B003《百年孤独》，
初始均 `available`。空集合＝无任何图书。

运行方式：
- TS：`npm test`
- PY：`python3 -m unittest discover -s tests -v`

## 用户场景（任务卡 §7 验收标准）

| 编号 | 场景 | Given | When | Then |
|---|---|---|---|---|
| AC-1 | 列出样例图书 | 集合含 B001 / B002 / B003，均可借 | 查看列表 | 三行，编号/名称/状态均正确，状态显示「可借」 |
| AC-2 | 借出后的展示 | B001 已借出 | 查看列表 | B001 一行显示「已借出」 |
| AC-3 | 归还后的展示 | B001 借出后归还 | 查看列表 | B001 一行显示「可借」 |
| AC-4 | 空集合 | 集合为空 | 查看列表 | 输出「暂无图书」 |

## 输出格式

| 编号 | 场景 | 期望 |
|---|---|---|
| F-1 | 单本格式 | 行为 `B001 三体 可借`（编号 空格 名称 空格 状态标签） |
| F-2 | 多行顺序 | 按集合插入顺序逐行输出，行间 `\n` |
| F-3 | 未知状态回退 | 状态非 `available`/`borrowed` 时原样显示，不抛错 |

## 分发与集成

| 编号 | 场景 | 期望 |
|---|---|---|
| I-1 (TS) | 注册到分发面 | `registerListCommand(registrar, store)` 后，`registrar` 收到名字 `list` 与处理器 |
| I-2 (TS) | 处理器读取 store | 处理器输出等于对当前 `listAll()` 的格式化结果 |
| I-3 (PY) | 覆盖 FP-005 占位 | `library.cli.dispatch(["list"])` 返回真实列表文本（不再是「命令已受理」） |
| I-4 (PY) | 统一输出 | `library.cli.run(["list"], out=StringIO)` 把文本写入并返回 |
| I-5 (PY) | 空集合经分发 | 清空集合后 `dispatch(["list"])` 返回「暂无图书」 |
| I-6 (PY) | 忽略多余参数 | `dispatch(["list", "x"])` 不报错，返回列表文本 |
| I-7 (PY) | CLI 冒烟 | `python3 -m library list` 进程退出码 0 且 stdout 含样例三本 |

## 边界与错误路径

| 编号 | 场景 | 期望 |
|---|---|---|
| E-1 | 空集合格式化 | `format_books([])` / `formatBookList([])` 返回「暂无图书」 |
| E-2 | 集合由空变有 | 加入图书后再查看，返回图书行（不缓存空结果） |
| E-3 | 集合由有变空 | 清空后再查看，返回「暂无图书」 |
| E-4 | 状态变化即时反映 | 同一集合上 `set_status` 后再次查看，状态标签随之变化 |

## 验收映射

- AC-1 → TS `lists the three seeded books` / PY `test_lists_three_seeded_books`
- AC-2 → `shows a borrowed book as 已借出`
- AC-3 → `shows a returned book as 可借`
- AC-4 → `reports an empty list as 暂无图书`
- I-3/I-5 → PY `test_default_dispatcher_serves_formatted_list` 等
