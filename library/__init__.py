"""Library management MVP package."""

from library import book_store, cli, list_books

# Mount the real `list` handler (FP-010) over FP-005's placeholder.
cli.register("list", list_books.create_list_handler(book_store.book_store))

__all__ = ["book_store", "cli", "list_books"]
