"""Tests for FP-006 借阅命令入口 (Python CLI stack).

The entry parses ``borrow <bookId> <borrower>``, rejects a missing
borrower, delegates to FP-007 ``borrow_books.borrow`` and returns the
result message. The dispatcher integration tests drive the real FP-005
``library.cli`` dispatcher.
"""

import subprocess
import sys
import unittest
from pathlib import Path

from library import book_store as book_store_module
from library import borrow_books as borrow_books_module
from library import borrow_command, cli
from library.book_store import AVAILABLE, BORROWED, BookStore

REPO_ROOT = Path(__file__).resolve().parent.parent


def seeded_store():
    """Task-card §6 seed: B001 available; B002 borrowed by u1; B999 absent."""
    store = BookStore()
    store.create("B001", "三体")
    store.create("B002", "活着")
    store.set_status("B002", BORROWED, "u1")
    return store


class RecordingExecutor:
    """Fake FP-007 executor that records calls and returns a canned result."""

    def __init__(self, result):
        self.calls = []
        self.result = result

    def __call__(self, book_id, borrower):
        self.calls.append((book_id, borrower))
        return self.result


class AcceptanceTests(unittest.TestCase):
    """任务卡 §7 的三条验收标准，经真实分发器驱动。"""

    def setUp(self):
        self.store = seeded_store()
        cli.register(
            "borrow", borrow_command.create_borrow_handler(store=self.store)
        )

    def tearDown(self):
        cli.register("borrow", borrow_command.create_borrow_handler())

    def test_ac1_borrow_b001_u1_reports_success_and_changes_state(self):
        text = cli.dispatch(["borrow", "B001", "u1"])

        self.assertEqual(text, borrow_books_module.BORROW_SUCCESS_MESSAGE)
        book = self.store.find("B001")
        self.assertEqual(book.status, BORROWED)
        self.assertEqual(book.borrower, "u1")

    def test_ac2_missing_borrower_is_rejected_without_borrowing(self):
        text = cli.dispatch(["borrow", "B001"])

        self.assertEqual(text, "借阅人标识缺失")
        book = self.store.find("B001")
        self.assertEqual(book.status, AVAILABLE)
        self.assertIsNone(book.borrower)

    def test_ac3_already_borrowed_passes_the_rejection_through(self):
        self.assertEqual(
            cli.dispatch(["borrow", "B002", "u1"]), "该图书已借出"
        )


class ParsingTests(unittest.TestCase):
    def test_p1_splits_the_first_two_tokens(self):
        self.assertEqual(
            borrow_command.parse_borrow_args(["B001", "u1"]), ("B001", "u1")
        )

    def test_p2_missing_borrower_is_none(self):
        self.assertIsNone(borrow_command.parse_borrow_args(["B001"]))
        self.assertIsNone(borrow_command.parse_borrow_args([]))

    def test_p3_blank_borrower_is_missing(self):
        for blank in ("", "   ", "\t"):
            with self.subTest(blank=blank):
                self.assertIsNone(
                    borrow_command.parse_borrow_args(["B001", blank])
                )

    def test_p4_extra_tokens_are_ignored(self):
        self.assertEqual(
            borrow_command.parse_borrow_args(["B001", "u1", "extra"]),
            ("B001", "u1"),
        )

    def test_p5_borrower_is_kept_verbatim(self):
        self.assertEqual(
            borrow_command.parse_borrow_args(["B001", "  u1 "]),
            ("B001", "  u1 "),
        )

    def test_p6_blank_book_id_parses_when_borrower_present(self):
        self.assertEqual(
            borrow_command.parse_borrow_args(["", "u1"]), ("", "u1")
        )


class HandlingTests(unittest.TestCase):
    """T-1..T-3: delegation and message pass-through."""

    def test_t1_calls_executor_with_parsed_pair_and_returns_message(self):
        fake = RecordingExecutor(
            borrow_books_module.BorrowResult(True, "借阅成功")
        )

        text = borrow_command.handle_borrow(["B001", "u1"], fake)

        self.assertEqual(fake.calls, [("B001", "u1")])
        self.assertEqual(text, "借阅成功")

    def test_t2_missing_borrower_never_reaches_the_executor(self):
        for args in ([], ["B001"], ["B001", "  "]):
            with self.subTest(args=args):
                fake = RecordingExecutor(
                    borrow_books_module.BorrowResult(True, "借阅成功")
                )
                self.assertEqual(
                    borrow_command.handle_borrow(args, fake), "借阅人标识缺失"
                )
                self.assertEqual(fake.calls, [])

    def test_t3_rejection_message_is_passed_through(self):
        for message in ("该图书已借出", "图书不存在"):
            with self.subTest(message=message):
                fake = RecordingExecutor(
                    borrow_books_module.BorrowResult(False, message)
                )
                self.assertEqual(
                    borrow_command.handle_borrow(["B002", "u1"], fake), message
                )

    def test_t4_missing_borrower_text_matches_shared_contract(self):
        self.assertEqual(borrow_command.BORROWER_MISSING_MESSAGE, "借阅人标识缺失")


class EdgeAndErrorTests(unittest.TestCase):
    def test_e1_unknown_id_or_blank_id_passes_through_book_not_found(self):
        store = seeded_store()
        handler = borrow_command.create_borrow_handler(store=store)

        self.assertEqual(handler(["B999", "u1"]), "图书不存在")
        self.assertEqual(handler(["", "u1"]), "图书不存在")

    def test_e2_free_text_borrower_is_stored_verbatim(self):
        store = seeded_store()
        borrower = "  u1 / #图书馆 <读者>  "
        handler = borrow_command.create_borrow_handler(store=store)

        self.assertEqual(handler(["B001", borrower]), "借阅成功")
        self.assertEqual(store.find("B001").borrower, borrower)

    def test_e3_rejected_commands_leave_the_collection_untouched(self):
        store = seeded_store()
        before = [(b.id, b.status, b.borrower) for b in store.list_all()]
        handler = borrow_command.create_borrow_handler(store=store)

        handler(["B001"])
        handler(["B001", "   "])
        handler([])

        after = [(b.id, b.status, b.borrower) for b in store.list_all()]
        self.assertEqual(after, before)

    def test_e4_defaults_to_the_shared_singleton(self):
        shared = book_store_module.book_store
        shared.clear()
        try:
            shared.create("B001", "三体")

            self.assertEqual(
                borrow_command.create_borrow_handler()(["B001", "u1"]),
                "借阅成功",
            )
            self.assertEqual(shared.find("B001").borrower, "u1")
        finally:
            shared.clear()


class StartupTests(unittest.TestCase):
    """End-to-end smoke through ``python3 -m library borrow ...``."""

    def test_smoke_success(self):
        result = subprocess.run(
            [sys.executable, "-m", "library", "borrow", "B001", "u1"],
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "借阅成功")

    def test_smoke_missing_borrower(self):
        result = subprocess.run(
            [sys.executable, "-m", "library", "borrow", "B001"],
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "借阅人标识缺失")


if __name__ == "__main__":
    unittest.main()
