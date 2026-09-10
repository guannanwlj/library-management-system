# FP-005 设计说明：命令行入口框架

## 目标
提供一个本地命令行骨架：把输入的第一个词识别为子命令
（`borrow` / `return` / `list`），把后续参数交给该子命令注册的
处理器，并统一输出处理器返回的结果文本。全程不做登录或权限校验。

## 关键决策

### 1. 实现语言与包结构
仓库无既有代码，任务卡标注「语言无关」，但拆解的集成约定使用
`tests/integration/test_*.py`，故采用 Python 3（标准库，无第三方依赖）。
新增顶层包 `library`，框架位于 `library/cli.py`：
- `library/__init__.py`：包标记与版本。
- `library/cli.py`：框架全部实现。
其他任务（FP-006 / FP-008 / FP-010）在同一包内挂载各自处理器。

### 2. 处理器契约
```python
Handler = Callable[[list[str]], str]
```
- 入参：子命令之后的全部参数（原始 token 列表，不做业务校验）。
- 返回：结果文本字符串，由框架统一输出。
具体业务（参数个数校验、调用执行逻辑、文案）由各命令入口任务负责，
本框架只解析、分发、输出。

### 3. 注册 / 挂载点
`CommandDispatcher.register(name, handler)` 提供挂载点，重复注册
同名子命令时以后者覆盖，便于真实处理器替换占位实现。模块级暴露
默认单例 `dispatcher` 及便捷函数 `register(name, handler)`，使下游
任务可 `from library.cli import register` 直接挂载。

### 4. 解析与分发
`parse(argv)` 取首 token 为子命令名，其余 token 为参数；`dispatch`
调用对应处理器并返回其文本；子命令未注册（含空输入）返回固定文案
`未知命令`。`run(argv, out)` 在 `dispatch` 上增加统一输出（默认
`sys.stdout`），并作为 `main` 的入口。

### 5. 占位处理器
`borrow` / `return` / `list` 由 `create_default_dispatcher()` 预注册
占位处理器，返回 `命令已受理`，满足本任务自包含可验证；真实处理器
由 FP-006 / FP-008 / FP-010 覆盖。

### 6. 无认证 / 无授权
框架不引入任何身份、会话、权限概念，任何输入都被直接解析分发。
该约束通过「分发前无前置校验」的代码结构保证，并在测试中以处理器
直接生效佐证。

## 测试策略
使用标准库 `unittest`（环境未安装 pytest），`python3 -m unittest
discover` 即可运行。以记录调用的假处理器断言分发命中与参数透传，
覆盖三个子命令、未知命令、空输入、参数透传、覆盖注册、统一输出与
占位处理器。用例清单见 `docs/test-cases/FP-005-cli-entry-framework.md`。

## 非范围
各子命令的真实业务逻辑（FP-006 / FP-007 / FP-008 / FP-009 /
FP-010）不在本任务内，本任务只提供框架与挂载点。
