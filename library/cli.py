"""Command-line entry framework for the library management MVP.

The framework recognizes the first token of the command line as a
subcommand (``borrow`` / ``return`` / ``list``), hands the remaining
tokens to the handler registered for that subcommand, and prints the
handler's result text. It performs no authentication or authorization.

Real subcommand behaviour is supplied by other tasks through
:meth:`CommandDispatcher.register`; until then the default dispatcher
serves placeholder handlers.
"""

from __future__ import annotations

import sys
from typing import Callable, Dict, List, Optional, Sequence, TextIO, Tuple

Handler = Callable[[List[str]], str]

UNKNOWN_COMMAND_MESSAGE = "未知命令"
PLACEHOLDER_MESSAGE = "命令已受理"
SUBCOMMANDS = ("borrow", "return", "list")

ParserResult = Tuple[Optional[str], List[str]]


class CommandDispatcher:
    """Map subcommand names to handlers and route input tokens to them."""

    def __init__(self) -> None:
        self._handlers: Dict[str, Handler] = {}

    def register(self, name: str, handler: Handler) -> Handler:
        """Mount ``handler`` for subcommand ``name``.

        Re-registering a name replaces the previous handler, so real
        handlers can take over the placeholders. Returns the handler to
        allow use as a decorator.
        """
        if not name:
            raise ValueError("subcommand name must be non-empty")
        if not callable(handler):
            raise TypeError("handler must be callable")
        self._handlers[name] = handler
        return handler

    def parse(self, argv: Sequence[str]) -> ParserResult:
        """Split tokens into (subcommand, arguments)."""
        tokens = list(argv)
        if not tokens:
            return None, []
        return tokens[0], tokens[1:]

    def dispatch(self, argv: Sequence[str]) -> str:
        """Route ``argv`` to its handler and return the result text."""
        name, args = self.parse(argv)
        handler = self._handlers.get(name) if name else None
        if handler is None:
            return UNKNOWN_COMMAND_MESSAGE
        return handler(args)

    def run(
        self,
        argv: Optional[Sequence[str]] = None,
        out: Optional[TextIO] = None,
    ) -> str:
        """Dispatch ``argv`` (default: process args) and print the result."""
        if argv is None:
            argv = sys.argv[1:]
        if out is None:
            out = sys.stdout
        text = self.dispatch(argv)
        print(text, file=out)
        return text


def create_placeholder_handler() -> Handler:
    """Build a handler that acknowledges the command without doing work."""

    def handler(_args: List[str]) -> str:
        return PLACEHOLDER_MESSAGE

    return handler


def create_default_dispatcher() -> CommandDispatcher:
    """Build a dispatcher with placeholders for every known subcommand."""
    dispatcher = CommandDispatcher()
    for name in SUBCOMMANDS:
        dispatcher.register(name, create_placeholder_handler())
    return dispatcher


dispatcher = create_default_dispatcher()


def register(name: str, handler: Handler) -> Handler:
    """Mount ``handler`` on the shared default dispatcher."""
    return dispatcher.register(name, handler)


def dispatch(argv: Sequence[str]) -> str:
    """Dispatch through the shared default dispatcher."""
    return dispatcher.dispatch(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    """Console entry point."""
    dispatcher.run(argv)
    return 0


if __name__ == "__main__":
    # Delegate to the package module so handlers mounted on
    # ``library.cli.dispatcher`` (imported via the package __init__) are
    # visible when this file is executed with ``python -m library.cli``.
    from library import cli as _cli
    from library.book_store import seed_sample_books

    seed_sample_books()
    raise SystemExit(_cli.main())
