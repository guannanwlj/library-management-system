"""FP-010 图书列表查询与展示：读取全部图书并格式化输出。

只读展示：`list` 子命令的处理器读取数据源的全部图书，每本输出一行
「编号 名称 状态」，状态以「可借 / 已借出」呈现，空集合输出「暂无图书」。
"""

from __future__ import annotations

from typing import Callable, Iterable, List, Protocol

EMPTY_LIST_MESSAGE = "暂无图书"

STATUS_LABELS = {"available": "可借", "borrowed": "已借出"}

Handler = Callable[[List[str]], str]


class BookLike(Protocol):
    """数据契约 FP-001 §3.1 中 Book 的最小结构视图。"""

    id: str
    title: str
    status: str


class BookSource(Protocol):
    """提供全部图书的数据源；FP-001 的 `listAll()` 对应 `list_all()`。"""

    def list_all(self) -> Iterable[BookLike]:
        ...


def status_label(status: str) -> str:
    """把状态值映射为展示文案；未知值原样回退，展示层不因此崩溃。"""
    return STATUS_LABELS.get(status, status)


def format_books(books: Iterable[BookLike]) -> str:
    """逐行格式化图书；空集合返回 `暂无图书`。"""
    lines: List[str] = [
        f"{book.id} {book.title} {status_label(book.status)}" for book in books
    ]
    if not lines:
        return EMPTY_LIST_MESSAGE
    return "\n".join(lines)


def create_list_handler(source: BookSource) -> Handler:
    """构造 `list` 处理器：每次调用都重新读取数据源，不做缓存。"""

    def handler(_args: List[str]) -> str:
        return format_books(source.list_all())

    return handler
