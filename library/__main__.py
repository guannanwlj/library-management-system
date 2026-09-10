"""Entry point: ``python3 -m library <subcommand>``.

Seeds the sample books (the placeholder for FP-002's startup init) and
then hands off to the FP-005 dispatcher.
"""

from __future__ import annotations

from typing import Optional, Sequence

from library import cli
from library.book_store import seed_sample_books


def main(argv: Optional[Sequence[str]] = None) -> int:
    seed_sample_books()
    return cli.main(argv)


if __name__ == "__main__":
    raise SystemExit(main())
