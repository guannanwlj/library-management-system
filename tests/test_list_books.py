import io
import subprocess
import sys
import unittest
from pathlib import Path

from library import book_store, cli, list_books
from library.book_store import BookStore

REPO_ROOT = Path(__file__).resolve().parent.parent


def seeded_store():
    store = BookStore()
    store.create("B001", "三体")
    store.create("B002", "活着")
    store.create("B003", "百年孤独")
    return store


class FormattingTests(unittest.TestCase):
    """AC-1..AC-4 and the format contract, on an isolated store."""

    def test_ac1_lists_three_seeded_books(self):
        text = list_books.format_books(seeded_store().list_all())
        self.assertEqual(
            text,
            "B001 三体 可借\nB002 活着 可借\nB003 百年孤独 可借",
        )

    def test_ac2_shows_a_borrowed_book_as_yi_jie_chu(self):
        store = seeded_store()
        store.set_status("B001", book_store.BORROWED, "u1")

        text = list_books.format_books(store.list_all())

        self.assertIn("B001 三体 已借出", text.splitlines())
        self.assertIn("B002 活着 可借", text.splitlines())

    def test_ac3_shows_a_returned_book_as_ke_jie(self):
        store = seeded_store()
        store.set_status("B001", book_store.BORROWED, "u1")
        store.set_status("B001", book_store.AVAILABLE)

        text = list_books.format_books(store.list_all())

        self.assertIn("B001 三体 可借", text.splitlines())

    def test_ac4_reports_an_empty_list(self):
        self.assertEqual(
            list_books.format_books([]), list_books.EMPTY_LIST_MESSAGE
        )
        self.assertEqual(list_books.format_books([]), "暂无图书")

    def test_f1_single_book_format(self):
        book = book_store.Book(id="B001", title="三体")

        self.assertEqual(list_books.format_books([book]), "B001 三体 可借")

    def test_f2_preserves_collection_order(self):
        store = BookStore()
        store.create("B003", "第三")
        store.create("B001", "第一")

        self.assertEqual(
            list_books.format_books(store.list_all()).split("\n"),
            ["B003 第三 可借", "B001 第一 可借"],
        )

    def test_f3_unknown_status_falls_back_to_raw_value(self):
        book = book_store.Book(id="B001", title="三体", status="archived")

        self.assertEqual(list_books.format_books([book]), "B001 三体 archived")


class HandlerTests(unittest.TestCase):
    def test_handler_reads_the_source_on_each_call(self):
        store = seeded_store()
        handler = list_books.create_list_handler(store)

        self.assertEqual(handler([]), list_books.format_books(store.list_all()))

        store.set_status("B002", book_store.BORROWED, "u2")
        self.assertIn("B002 活着 已借出", handler([]).splitlines())

    def test_handler_ignores_extra_arguments(self):
        handler = list_books.create_list_handler(seeded_store())

        self.assertEqual(handler(["noise"]), handler([]))


class DispatcherIntegrationTests(unittest.TestCase):
    """I-3..I-6: the real FP-005 dispatcher serves the real handler."""

    def setUp(self):
        self.store = book_store.book_store
        self.store.clear()

    def tearDown(self):
        self.store.clear()

    def test_i3_default_dispatcher_serves_formatted_list(self):
        self.store.create("B001", "三体")

        self.assertEqual(cli.dispatch(["list"]), "B001 三体 可借")

    def test_i4_run_writes_and_returns_text(self):
        self.store.create("B001", "三体")
        out = io.StringIO()

        result = cli.dispatcher.run(["list"], out=out)

        self.assertEqual(result, "B001 三体 可借")
        self.assertEqual(out.getvalue(), "B001 三体 可借\n")

    def test_i5_empty_collection_through_dispatcher(self):
        self.assertEqual(cli.dispatch(["list"]), "暂无图书")

    def test_i6_extra_arguments_are_ignored(self):
        self.store.create("B001", "三体")

        self.assertEqual(cli.dispatch(["list", "x"]), "B001 三体 可借")

    def test_register_mounts_a_custom_source(self):
        custom = seeded_store()
        cli.register("list", list_books.create_list_handler(custom))
        try:
            self.assertIn("B003 百年孤独 可借", cli.dispatch(["list"]))
        finally:
            cli.register("list", list_books.create_list_handler(self.store))


class StartupTests(unittest.TestCase):
    """The app entry point seeds the sample books before listing."""

    def test_seed_sample_books_is_idempotent(self):
        store = BookStore()

        first = book_store.seed_sample_books(store)
        second = book_store.seed_sample_books(store)

        self.assertEqual([b.id for b in first], ["B001", "B002", "B003"])
        self.assertEqual(second, [])
        self.assertTrue(all(b.status == book_store.AVAILABLE for b in store.list_all()))

    def test_cli_module_smoke(self):
        result = subprocess.run(
            [sys.executable, "-m", "library", "list"],
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("B001 三体 可借", result.stdout)

    def test_cli_submodule_smoke(self):
        result = subprocess.run(
            [sys.executable, "-m", "library.cli", "list"],
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("B002 活着 可借", result.stdout)


if __name__ == "__main__":
    unittest.main()
