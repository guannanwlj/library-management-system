"""FP-007 借出执行与状态变更（Python CLI 栈）。

借阅主流程的核心执行：按编号查找图书 → 判定（任务卡 §6 的内联最小规则，
对应 FP-004）→ 合法时把状态置为 ``borrowed``、写入借阅人并返回成功；
非法时返回固定错误文案且不改变状态与借阅记录。

对外执行契约（供将来的 FP-006 借阅命令入口调用）::

    borrow(book_id, borrower, store=None) -> BorrowResult(ok, message)

真正的 FP-001 / FP-003 / FP-004 只有 TypeScript 实现；本模块按任务卡 §6
复用 ``library.book_store`` 的最小兜底集合与内联规则，文案与 TS 版逐字
一致。真实现合入 Python 后替换兜底即可，本模块的编排逻辑不变。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from library.book_store import BORROWED, Book, BookStore, book_store

#: 借出成功文案（任务卡未规定拒绝以外的文案）。
BORROW_SUCCESS_MESSAGE = "借阅成功"

#: 固定拒绝文案（与 FP-004 / TS 版逐字一致）。
BOOK_NOT_FOUND_MESSAGE = "图书不存在"
ALREADY_BORROWED_MESSAGE = "该图书已借出"
BORROWER_MISSING_MESSAGE = "借阅人标识缺失"


@dataclass(frozen=True)
class BorrowResult:
    """借出执行结果：``ok`` 为唯一判据，``message`` 为成功或固定错误文案。"""

    ok: bool
    message: str


def _rejection(book: Optional[Book], borrower: Optional[str]) -> Optional[str]:
    """内联最小规则（FP-004 §6 兜底）：存在性 → 状态 → 借阅人标识。

    返回拒绝文案；``None`` 表示允许。
    """
    if book is None:
        return BOOK_NOT_FOUND_MESSAGE
    if book.status == BORROWED:
        return ALREADY_BORROWED_MESSAGE
    if borrower is None or borrower.strip() == "":
        return BORROWER_MISSING_MESSAGE
    return None


def borrow(
    book_id: str,
    borrower: Optional[str],
    store: Optional[BookStore] = None,
) -> BorrowResult:
    """执行一次借出。

    先查找并判定：不允许则原样返回错误文案，且不触碰集合；允许则把状态
    置为 ``borrowed``、借阅人置为入参。借阅人自由文本原样保存，合法性由
    规则层保证。

    ``store`` 默认进程内单例；测试可注入隔离集合。
    """
    target = book_store if store is None else store
    rejection = _rejection(target.find(book_id), borrower)
    if rejection is not None:
        return BorrowResult(False, rejection)

    target.set_status(book_id, BORROWED, borrower)
    return BorrowResult(True, BORROW_SUCCESS_MESSAGE)
