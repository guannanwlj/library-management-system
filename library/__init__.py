"""Library management MVP package."""

from library import (
    book_store,
    borrow_books,
    borrow_command,
    cli,
    list_books,
    return_book,
    return_command,
)

# Mount the real handlers over FP-005's placeholders.
cli.register("list", list_books.create_list_handler(book_store.book_store))
cli.register("return", return_command.create_return_handler(book_store.book_store))

# Mount the real `borrow` handler (FP-006) over FP-005's placeholder.
cli.register("borrow", borrow_command.create_borrow_handler())

__all__ = [
    "book_store",
    "borrow_books",
    "borrow_command",
    "cli",
    "list_books",
    "return_book",
    "return_command",
]
