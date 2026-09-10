"""FP-009 归还执行与状态恢复（Python 侧）。

一次真实的归还：按编号查找图书 → 内联的归还规则判定 → 合法时恢复
``available`` 并清除借阅记录（``borrower = None``），返回 ``ReturnResult``；
非法时返回固定文案且不改动任何状态。

FP-001 / FP-003 / FP-004 只有 TypeScript 实现，Python 进程无法读取，
故按任务卡 §6 复用 ``library/book_store.py`` 这份最小兜底集合，并内联
最小归还规则判定。真实现合入后，替换数据源与规则函数即可。

归还人不与记录的借阅人做一致性校验（D3 自由文本），故本函数不接收
归还人，记录中的借阅人不会阻碍归还。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from library.book_store import AVAILABLE, Book, BookStore, book_store

RETURN_SUCCESS_MESSAGE = "归还成功"
BOOK_NOT_FOUND_MESSAGE = "图书不存在"
NOT_BORROWED_MESSAGE = "该图书未借出"


@dataclass(frozen=True)
class ReturnResult:
    """归还执行结果：``ok`` 表示是否完成归还，``message`` 为成功/错误文案。"""

    ok: bool
    message: str


def _check_return(book: Optional[Book]) -> Optional[str]:
    """内联最小归还规则：存在性 → 状态。合法时返回 ``None``。"""
    if book is None:
        return BOOK_NOT_FOUND_MESSAGE
    if book.status == AVAILABLE:
        return NOT_BORROWED_MESSAGE
    return None


def return_book(
    book_id: str, store: Optional[BookStore] = None
) -> ReturnResult:
    """执行一次归还。

    :param book_id: 图书编号；不存在或未借出时返回对应错误。
    :param store: 图书集合，默认进程内单例 ``library.book_store.book_store``。
    """
    target = book_store if store is None else store
    error = _check_return(target.find(book_id))
    if error is not None:
        return ReturnResult(ok=False, message=error)

    target.set_status(book_id, AVAILABLE)
    return ReturnResult(ok=True, message=RETURN_SUCCESS_MESSAGE)
