import io
import subprocess
import sys
import unittest
from pathlib import Path

from library import book_store, cli, return_command
from library.book_store import BookStore

REPO_ROOT = Path(__file__).resolve().parent.parent


def seeded_store():
    store = BookStore()
    store.create("B001", "三体")
    store.create("B002", "活着")
    store.set_status("B002", book_store.BORROWED, "u1")
    return store


class AcceptanceTests(unittest.TestCase):
    """任务卡 §7 的三条验收标准。"""

    def test_ac1_returning_a_borrowed_book_reports_success(self):
        store = seeded_store()
        handler = return_command.create_return_handler(store)

        text = handler(["B002"])

        self.assertEqual(text, "归还成功")
        self.assertEqual(store.find("B002").status, book_store.AVAILABLE)
        self.assertIsNone(store.find("B002").borrower)

    def test_ac2_available_book_passes_through_the_rejection(self):
        store = seeded_store()

        text = return_command.create_return_handler(store)(["B001"])

        self.assertEqual(text, "该图书未借出")
        self.assertEqual(store.find("B001").status, book_store.AVAILABLE)

    def test_ac3_unknown_id_reports_book_not_found(self):
        store = seeded_store()

        text = return_command.create_return_handler(store)(["B999"])

        self.assertEqual(text, "图书不存在")
        self.assertIsNone(store.find("B999"))


class ParsingTests(unittest.TestCase):
    def test_p1_takes_the_first_token(self):
        self.assertEqual(return_command.parse_book_id(["B002"]), "B002")
        self.assertEqual(return_command.parse_book_id(["B002", "noise"]), "B002")

    def test_p2_missing_argument_parses_to_empty_id(self):
        self.assertEqual(return_command.parse_book_id([]), "")

    def test_p3_extra_arguments_are_ignored(self):
        with_extra = return_command.create_return_handler(seeded_store())
        single = return_command.create_return_handler(seeded_store())

        self.assertEqual(with_extra(["B002", "extra"]), single(["B002"]))


class OutputTests(unittest.TestCase):
    def test_o1_to_o3_output_is_the_fp009_message(self):
        for book_id, expected in (("B001", "该图书未借出"), ("B999", "图书不存在")):
            with self.subTest(book_id=book_id):
                handler = return_command.create_return_handler(seeded_store())
                self.assertEqual(handler([book_id]), expected)

    def test_o4_second_return_is_rejected(self):
        handler = return_command.create_return_handler(seeded_store())

        self.assertEqual(handler(["B002"]), "归还成功")
        self.assertEqual(handler(["B002"]), "该图书未借出")


class DispatcherIntegrationTests(unittest.TestCase):
    """I-3..I-5: the real FP-005 dispatcher serves the real handler."""

    def setUp(self):
        self.store = book_store.book_store
        self.store.clear()

    def tearDown(self):
        self.store.clear()

    def test_i3_default_dispatcher_serves_return(self):
        self.store.create("B001", "三体")

        self.assertEqual(cli.dispatch(["return", "B001"]), "该图书未借出")
        self.assertNotEqual(cli.dispatch(["return", "B001"]), cli.PLACEHOLDER_MESSAGE)

    def test_i3_default_dispatcher_reports_success_for_a_borrowed_book(self):
        self.store.create("B001", "三体")
        self.store.set_status("B001", book_store.BORROWED, "u1")

        self.assertEqual(cli.dispatch(["return", "B001"]), "归还成功")

    def test_i4_run_writes_and_returns_text(self):
        out = io.StringIO()

        result = cli.dispatcher.run(["return", "B999"], out=out)

        self.assertEqual(result, "图书不存在")
        self.assertEqual(out.getvalue(), "图书不存在\n")

    def test_i5_defaults_to_the_shared_singleton(self):
        self.store.create("B001", "三体")
        self.store.set_status("B001", book_store.BORROWED, "u1")

        self.assertEqual(return_command.create_return_handler()(["B001"]), "归还成功")
        self.assertIsNone(self.store.find("B001").borrower)


class EdgeAndErrorTests(unittest.TestCase):
    def test_e1_empty_arguments_are_rejected_without_side_effects(self):
        store = seeded_store()
        before = [(b.id, b.status, b.borrower) for b in store.list_all()]

        self.assertEqual(return_command.create_return_handler(store)([]), "图书不存在")
        self.assertEqual(
            [(b.id, b.status, b.borrower) for b in store.list_all()], before
        )

    def test_e2_blank_ids_are_treated_as_unknown(self):
        handler = return_command.create_return_handler(seeded_store())

        for book_id in ("", "   "):
            with self.subTest(book_id=book_id):
                self.assertEqual(handler([book_id]), "图书不存在")

    def test_e4_repeated_failures_have_no_side_effects(self):
        store = seeded_store()
        before = [(b.id, b.status, b.borrower) for b in store.list_all()]
        handler = return_command.create_return_handler(store)

        handler(["B001"])
        handler(["B999"])
        handler(["B001"])

        self.assertEqual(
            [(b.id, b.status, b.borrower) for b in store.list_all()], before
        )


class StartupTests(unittest.TestCase):
    """The app entry point seeds the sample books before returning."""

    def test_cli_module_smoke_for_unknown_book(self):
        result = subprocess.run(
            [sys.executable, "-m", "library", "return", "B999"],
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("图书不存在", result.stdout)

    def test_cli_module_smoke_for_available_book(self):
        result = subprocess.run(
            [sys.executable, "-m", "library", "return", "B001"],
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("该图书未借出", result.stdout)


if __name__ == "__main__":
    unittest.main()
