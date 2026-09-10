# 设计说明 FP-010：图书列表查询与展示

> 任务来源：FP-010（源 UC-003 查看图书列表与借阅状态）｜波次 2｜里程碑 M2
> 技术栈：语言无关（本仓库实际为 TypeScript + Python 双栈，见 §2）。

## 1. 目标与范围

只读展示：被 `list` 子命令调用，读取全部图书，把每本图书格式化为
一行「编号 名称 状态」，状态以「可借 / 已借出」呈现；集合为空时
输出「暂无图书」。

范围外（任务卡 §5）：Book 实体与集合（FP-001）、命令行框架自身
（FP-005）、借出与归还（FP-006/007/008/009）。本任务只做「读取 +
格式化 + 挂载」。

## 2. 关键决策

### D1 双栈实现，因为两个强依赖分属不同运行时
任务卡标注「语言无关」，但这个仓库的两个上游依赖落在不同语言：

- FP-001 图书数据模型与内存存储 → **TypeScript**（`src/store/book-store.ts`，
  导出 `BookStore.listAll()` 与单例 `bookStore`）。
- FP-005 命令行入口框架 → **Python**（`library/cli.py`，`CommandDispatcher`
  与模块级 `register` / `dispatch`）。

两者无法在单一进程内互相调用。为忠实满足「FP-001 的 `listAll()`」与
「FP-005 的 `list` 子命令分发」两个契约，本任务在各自运行时各提供一份
薄封装：

- TS 侧：`src/features/list-books.ts`，直接消费真实 FP-001 的
  `listAll()`，并提供 `list` 处理器与注册适配器（分发面按 FP-005 §3.2
  的 `register(name, handler)` 形状对齐）。
- PY 侧：`library/list_books.py`，挂载到真实 FP-005 的分发器上，覆盖
  `list` 占位处理器。

两个运行时共享同一份**输出格式契约**（§3），因此对外行为一致。格式化
逻辑是这次改动的核心，双栈各自实现是为了适配运行时，而不是复制业务。

### D2 Python 侧用 §6 允许的「内联最小图书集合」作为数据兜底
FP-001 只有 TypeScript 实现，Python 进程无法读取它。按任务卡 §6
「依赖未实现时，用内联最小图书集合替代 FP-001」，新增
`library/book_store.py`：仅提供 `list_all()` 及验证所需的最小读写
（`create` / `find` / `set_status` / `clear`）与样例种子，**不是** FP-001
的完整实现（无重复编号、字段校验、错误类型等）。FP-010 的处理器
依赖一个鸭子类型的数据源（`list_all()`），一旦 FP-001 有了 Python
实现，替换该兜底即可，无需改处理器。

### D3 输出格式
- 每本图书一行：`{id} {title} {状态标签}`，行间以 `\n` 连接。
- 状态映射：`available` → `可借`，`borrowed` → `已借出`；未知状态
  原样回退，避免展示层因脏数据崩溃。
- 空集合 → `暂无图书`。
- 不使用括号或额外分隔符，最贴近契约「编号 名称 状态」。

### D4 处理器无副作用、忽略多余参数
`list` 只读，处理器不接收业务参数；FP-005 会把 `list` 之后的 token
原样传入，处理器忽略它们，保持「只读展示」语义。

## 3. 模块结构

TypeScript（消费真实 FP-001）：

```
src/features/list-books.ts   EMPTY_LIST_MESSAGE / formatBookLine / formatBookList /
                             createListBooksHandler(store) / registerListCommand(registrar, store)
```

Python（挂载真实 FP-005，数据兜底）：

```
library/book_store.py    Book / BookStore（§6 最小兜底）/ book_store / seed_sample_books
library/list_books.py    EMPTY_LIST_MESSAGE / STATUS_LABELS / format_books /
                         create_list_handler(source)
library/__init__.py      导入时把真实 list 处理器挂到 library.cli.dispatcher
library/__main__.py      python3 -m library list 入口（先载入样例种子）
library/cli.py           __main__ 委派到包内 cli，使 -m library.cli 也生效
```

对外 API：

```ts
// TypeScript
formatBookList(books: readonly Book[]): string          // 空 → '暂无图书'
createListBooksHandler(store: BookStore): (args) => string
registerListCommand(registrar, store): handler          // registrar.register('list', handler)
```

```python
# Python
format_books(books) -> str                              # 空 → '暂无图书'
create_list_handler(source) -> Handler                  # library/__init__ 挂到 cli.dispatcher
```

## 4. 验证方式

- TypeScript：`npm test`（`tsx --test tests/*.test.ts`）运行
  `tests/list-books.test.ts`；`npm run typecheck` 做类型检查。
- Python：`python3 -m unittest discover -s tests -v` 运行
  `tests/test_list_books.py`（含 `python3 -m library list` 子进程冒烟）。
- 用例清单见 `docs/test-cases/FP-010-list-books.md`。
