"""FP-006 借阅命令入口（Python CLI 栈）。

命令行层到借出逻辑的接线：解析 ``borrow <bookId> <borrower>`` 的两个
参数，校验参数个数与借阅人非空，调用 FP-007 的 ``borrow_books.borrow``，
并把结果文本输出。借出状态变更与合法性判定由 FP-007 负责，本模块只
解析、校验与透传。

真正的 FP-005 命令行框架（``library/cli.py``）在包导入时把本模块构造的
``borrow`` 处理器挂到分发器上。
"""

from __future__ import annotations

from typing import Callable, List, Optional, Tuple

from library import borrow_books
from library.book_store import BookStore
from library.borrow_books import BorrowResult

#: FP-005 契约的处理器形状：接收子命令参数，返回结果文本。
Handler = Callable[[List[str]], str]

#: 借出执行能力（FP-007 契约）；测试可注入假实现。
BorrowExecutor = Callable[[str, str], BorrowResult]

#: 借阅人标识缺失文案（与 FP-004 契约逐字一致）。
BORROWER_MISSING_MESSAGE = borrow_books.BORROWER_MISSING_MESSAGE


def parse_borrow_args(args: List[str]) -> Optional[Tuple[str, str]]:
    """解析 ``borrow`` 参数：前两个 token 依次为 ``book_id``、``borrower``。

    借阅人缺失（参数不足两个）或纯空白时返回 ``None``；多余 token 忽略。
    借阅人非空时原样返回（不 ``strip``，遵守 FP-003 自由文本约定）。
    """
    book_id = args[0] if len(args) > 0 else ""
    borrower = args[1] if len(args) > 1 else ""
    if borrower.strip() == "":
        return None
    return book_id, borrower


def handle_borrow(args: List[str], execute: BorrowExecutor) -> str:
    """处理一次 ``borrow`` 子命令：解析 → 校验 → 调用借出执行 → 返回文本。

    缺参时直接返回「借阅人标识缺失」，**不调用**执行函数；否则逐字返回
    执行结果的 ``message``（成功为「借阅成功」，失败为 FP-004 错误文案）。
    """
    parsed = parse_borrow_args(args)
    if parsed is None:
        return BORROWER_MISSING_MESSAGE
    book_id, borrower = parsed
    return execute(book_id, borrower).message


def _default_executor(store: Optional[BookStore]) -> BorrowExecutor:
    def execute(book_id: str, borrower: str) -> BorrowResult:
        return borrow_books.borrow(book_id, borrower, store)

    return execute


def create_borrow_handler(
    store: Optional[BookStore] = None,
    execute: Optional[BorrowExecutor] = None,
) -> Handler:
    """构造 ``borrow`` 处理器。

    :param store: 目标集合，默认进程内单例；仅在未注入 ``execute`` 时用于
        绑定默认的 FP-007 借出执行。
    :param execute: 借出执行函数；默认绑定到 ``borrow_books.borrow``。
    """
    run = execute if execute is not None else _default_executor(store)

    def handler(args: List[str]) -> str:
        return handle_borrow(args, run)

    return handler
