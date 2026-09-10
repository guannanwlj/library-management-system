"""FP-008 归还命令入口（Python CLI 栈）。

把 ``return <bookId>`` 的输入接到 FP-009 的归还执行上：解析第一个 token
作为图书编号 → 调用 :func:`library.return_book.return_book` → 返回其结果
文案（成功提示或 FP-004 的固定错误文案）。本模块只解析与透传，不做任何
规则判定或状态变更（那些由 FP-009 负责），也不实现命令行框架本身
（FP-005 的 :mod:`library.cli`）。
"""

from __future__ import annotations

from typing import Callable, List, Optional

from library.book_store import BookStore, book_store
from library.return_book import return_book

Handler = Callable[[List[str]], str]


def parse_book_id(args: List[str]) -> str:
    """解析 ``return`` 子命令参数：取第一个 token 作为图书编号。

    缺失参数返回空串，交由归还执行判为「图书不存在」；多余参数忽略。
    """
    return args[0] if args else ""


def create_return_handler(store: Optional[BookStore] = None) -> Handler:
    """构造 ``return`` 处理器：每次调用都执行一次归还并返回其结果文案。

    ``store`` 默认进程内单例，测试可注入隔离集合。
    """
    target = book_store if store is None else store

    def handler(args: List[str]) -> str:
        return return_book(parse_book_id(args), target).message

    return handler
