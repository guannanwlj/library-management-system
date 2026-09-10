"""Minimal in-memory book collection — the task-card §6 fallback for FP-001.

FP-001 (§3.1) is implemented in TypeScript (``src/store/book-store.ts``);
a Python process cannot read it. Per task FP-010 §6, this module is the
"内联最小图书集合" stand-in so the Python CLI (FP-005) can run the list
command standalone. It intentionally implements only the surface needed
by FP-010 plus enough to simulate borrow/return in tests — no validation,
error types or uniqueness rules. Replace it with the real FP-001 port
when one exists.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional

AVAILABLE = "available"
BORROWED = "borrowed"


@dataclass
class Book:
    """A book row as consumed by the list command (FP-001 §3.1 shape)."""

    id: str
    title: str
    status: str = AVAILABLE
    borrower: Optional[str] = None


class BookStore:
    """Insertion-ordered in-memory collection of :class:`Book`."""

    def __init__(self) -> None:
        self._books: Dict[str, Book] = {}

    def add(self, book: Book) -> Book:
        if book.id in self._books:
            raise ValueError(f"Duplicate book id: {book.id}")
        self._books[book.id] = book
        return book

    def create(self, book_id: str, title: str) -> Book:
        return self.add(Book(id=book_id, title=title))

    def list_all(self) -> List[Book]:
        return list(self._books.values())

    def find(self, book_id: str) -> Optional[Book]:
        return self._books.get(book_id)

    def set_status(
        self, book_id: str, status: str, borrower: Optional[str] = None
    ) -> Book:
        book = self._books.get(book_id)
        if book is None:
            raise KeyError(book_id)
        book.status = status
        book.borrower = None if status == AVAILABLE else borrower
        return book

    def clear(self) -> None:
        self._books.clear()


#: Process-wide collection shared by the CLI commands.
book_store = BookStore()

#: Sample seed: B001《三体》/ B002《活着》/ B003《百年孤独》, all available.
SAMPLE_BOOKS = (
    ("B001", "三体"),
    ("B002", "活着"),
    ("B003", "百年孤独"),
)


def seed_sample_books(store: Optional[BookStore] = None) -> List[Book]:
    """Load the sample books into ``store`` (default: the shared singleton).

    Idempotent: ids already present are skipped, so a running status is
    never overwritten. Returns the books actually added this call.
    """
    target = book_store if store is None else store
    added: List[Book] = []
    for book_id, title in SAMPLE_BOOKS:
        if target.find(book_id) is None:
            added.append(target.create(book_id, title))
    return added
