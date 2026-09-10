"""Library management MVP package."""

from library import book_store, cli, list_books, return_book, return_command

# Mount the real handlers over FP-005's placeholders.
cli.register("list", list_books.create_list_handler(book_store.book_store))
cli.register("return", return_command.create_return_handler(book_store.book_store))

__all__ = [
    "book_store",
    "cli",
    "list_books",
    "return_book",
    "return_command",
]
