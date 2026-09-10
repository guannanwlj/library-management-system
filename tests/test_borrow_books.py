"""Tests for FP-007 借出执行与状态变更 (Python CLI stack).

Mirrors tests/borrow-execution.test.ts against the minimal Python
``library.book_store`` fallback and the inline rules in ``borrow_books``.
"""

import unittest

from library import book_store as book_store_module
from library import borrow_books
from library.book_store import AVAILABLE, BORROWED, BookStore


def seeded_store():
    """Task-card §6 seed: B001 available; B002 borrowed by u1; B999 absent."""
    store = BookStore()
    store.create("B001", "三体")
    store.create("B002", "活着")
    store.set_status("B002", BORROWED, "u1")
    return store


class AcceptanceTests(unittest.TestCase):
    def test_ac1_borrowing_an_available_book_sets_status_and_borrower(self):
        store = seeded_store()

        result = borrow_books.borrow("B001", "u1", store)

        self.assertTrue(result.ok)
        book = store.find("B001")
        self.assertEqual(book.status, BORROWED)
        self.assertEqual(book.borrower, "u1")

    def test_ac2_reborrowing_a_borrowed_book_is_rejected_and_keeps_state(self):
        store = seeded_store()

        result = borrow_books.borrow("B002", "u1", store)

        self.assertFalse(result.ok)
        self.assertEqual(result.message, "该图书已借出")
        book = store.find("B002")
        self.assertEqual(book.status, BORROWED)
        self.assertEqual(book.borrower, "u1")

    def test_ac3_borrowing_an_unknown_id_is_rejected(self):
        store = seeded_store()

        result = borrow_books.borrow("B999", "u1", store)

        self.assertFalse(result.ok)
        self.assertEqual(result.message, "图书不存在")
        self.assertIsNone(store.find("B999"))

    def test_ac4_borrowing_without_a_borrower_is_rejected_and_keeps_state(self):
        store = seeded_store()

        result = borrow_books.borrow("B001", "", store)

        self.assertFalse(result.ok)
        self.assertEqual(result.message, "借阅人标识缺失")
        book = store.find("B001")
        self.assertEqual(book.status, AVAILABLE)
        self.assertIsNone(book.borrower)


class IndependentVerificationTests(unittest.TestCase):
    def test_t1_result_exposes_ok_and_message(self):
        success = borrow_books.borrow("B001", "u1", seeded_store())
        failure = borrow_books.borrow("B999", "u1", seeded_store())

        self.assertIsInstance(success.ok, bool)
        self.assertIsInstance(success.message, str)
        self.assertIsInstance(failure.ok, bool)
        self.assertIsInstance(failure.message, str)

    def test_t2_successful_borrow_is_visible_through_find_and_list(self):
        store = seeded_store()

        borrow_books.borrow("B001", "u1", store)

        book = store.find("B001")
        self.assertEqual(book.status, BORROWED)
        self.assertEqual(book.borrower, "u1")
        listed = {b.id: b for b in store.list_all()}["B001"]
        self.assertEqual(listed.status, BORROWED)
        self.assertEqual(listed.borrower, "u1")

    def test_t3_free_text_borrower_is_stored_verbatim(self):
        store = seeded_store()
        borrower = "  u1 / #图书馆 <读者>  "

        borrow_books.borrow("B001", borrower, store)

        self.assertEqual(store.find("B001").borrower, borrower)

    def test_t4_every_rejection_leaves_the_collection_untouched(self):
        store = seeded_store()
        before = [(b.id, b.title, b.status, b.borrower) for b in store.list_all()]

        borrow_books.borrow("B002", "u2", store)
        borrow_books.borrow("B999", "u1", store)
        borrow_books.borrow("B001", "", store)

        after = [(b.id, b.title, b.status, b.borrower) for b in store.list_all()]
        self.assertEqual(after, before)


class EdgeAndErrorTests(unittest.TestCase):
    def test_e1_none_borrower_is_rejected(self):
        store = seeded_store()

        result = borrow_books.borrow("B001", None, store)

        self.assertFalse(result.ok)
        self.assertEqual(result.message, "借阅人标识缺失")
        self.assertEqual(store.find("B001").status, AVAILABLE)

    def test_e3_blank_borrower_is_rejected(self):
        for borrower in ("   ", "\t", "\n"):
            with self.subTest(borrower=borrower):
                store = seeded_store()
                result = borrow_books.borrow("B001", borrower, store)
                self.assertFalse(result.ok)
                self.assertEqual(result.message, "借阅人标识缺失")
                self.assertEqual(store.find("B001").status, AVAILABLE)

    def test_e4_unknown_id_outranks_missing_borrower(self):
        result = borrow_books.borrow("B999", None, seeded_store())

        self.assertFalse(result.ok)
        self.assertEqual(result.message, "图书不存在")

    def test_e5_already_borrowed_outranks_missing_borrower(self):
        result = borrow_books.borrow("B002", None, seeded_store())

        self.assertFalse(result.ok)
        self.assertEqual(result.message, "该图书已借出")

    def test_e6_second_borrow_keeps_the_first_borrower(self):
        store = seeded_store()
        borrow_books.borrow("B001", "u1", store)

        result = borrow_books.borrow("B001", "u2", store)

        self.assertFalse(result.ok)
        self.assertEqual(result.message, "该图书已借出")
        self.assertEqual(store.find("B001").borrower, "u1")

    def test_e7_returned_book_can_be_borrowed_again(self):
        store = seeded_store()
        borrow_books.borrow("B001", "u1", store)
        store.set_status("B001", AVAILABLE)

        result = borrow_books.borrow("B001", "u2", store)

        self.assertTrue(result.ok)
        self.assertEqual(store.find("B001").status, BORROWED)
        self.assertEqual(store.find("B001").borrower, "u2")

    def test_e8_success_message_is_the_fixed_contract_text(self):
        self.assertEqual(borrow_books.BORROW_SUCCESS_MESSAGE, "借阅成功")

        result = borrow_books.borrow("B001", "u1", seeded_store())
        self.assertEqual(result.message, borrow_books.BORROW_SUCCESS_MESSAGE)

    def test_defaults_to_the_shared_singleton(self):
        shared = book_store_module.book_store
        shared.clear()
        try:
            shared.create("B001", "三体")

            result = borrow_books.borrow("B001", "u1")

            self.assertTrue(result.ok)
            self.assertEqual(shared.find("B001").borrower, "u1")
        finally:
            shared.clear()


if __name__ == "__main__":
    unittest.main()
