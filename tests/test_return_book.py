import unittest

from library import book_store as book_store_module
from library import return_book as return_book_module
from library.book_store import BookStore


def seeded_store():
    store = BookStore()
    store.create("B001", "三体")
    store.create("B002", "活着")
    store.set_status("B002", book_store_module.BORROWED, "u1")
    return store


class AcceptanceTests(unittest.TestCase):
    """任务卡 §7 的四条验收标准。"""

    def test_ac1_returns_a_borrowed_book_and_clears_its_borrower(self):
        store = seeded_store()

        result = return_book_module.return_book("B002", store)

        self.assertTrue(result.ok)
        self.assertEqual(result.message, return_book_module.RETURN_SUCCESS_MESSAGE)
        book = store.find("B002")
        self.assertEqual(book.status, book_store_module.AVAILABLE)
        self.assertIsNone(book.borrower)

    def test_ac2_rejects_returning_an_available_book_without_changing_state(self):
        store = seeded_store()

        result = return_book_module.return_book("B001", store)

        self.assertFalse(result.ok)
        self.assertEqual(result.message, "该图书未借出")
        book = store.find("B001")
        self.assertEqual(book.status, book_store_module.AVAILABLE)
        self.assertIsNone(book.borrower)

    def test_ac3_rejects_an_unknown_book_id(self):
        store = seeded_store()

        result = return_book_module.return_book("B999", store)

        self.assertFalse(result.ok)
        self.assertEqual(result.message, "图书不存在")
        self.assertIsNone(store.find("B999"))

    def test_ac4_does_not_compare_the_returner_with_the_recorded_borrower(self):
        store = seeded_store()

        result = return_book_module.return_book("B002", store)

        self.assertTrue(result.ok)
        self.assertIsNone(store.find("B002").borrower)


class IndependentTests(unittest.TestCase):
    """任务卡 §8 的独立验证场景。"""

    def test_t1_success_message_is_fixed(self):
        self.assertEqual(return_book_module.RETURN_SUCCESS_MESSAGE, "归还成功")
        result = return_book_module.return_book("B002", seeded_store())
        self.assertEqual(result.message, "归还成功")

    def test_t2_results_expose_ok_and_message(self):
        store = seeded_store()
        result = return_book_module.return_book("B002", store)

        self.assertIsInstance(result.ok, bool)
        self.assertIsInstance(result.message, str)

    def test_t3_repeated_return_is_rejected(self):
        store = seeded_store()

        first = return_book_module.return_book("B002", store)
        second = return_book_module.return_book("B002", store)

        self.assertTrue(first.ok)
        self.assertFalse(second.ok)
        self.assertEqual(second.message, "该图书未借出")

    def test_t4_returning_one_book_leaves_the_others_untouched(self):
        store = seeded_store()
        before = [(b.id, b.status, b.borrower) for b in store.list_all()]

        return_book_module.return_book("B002", store)

        b001 = store.find("B001")
        self.assertEqual(b001.status, book_store_module.AVAILABLE)
        self.assertIsNone(b001.borrower)
        self.assertEqual(len(before), len(store.list_all()))


class EdgeAndErrorTests(unittest.TestCase):
    def test_e1_available_book_is_rejected_and_keeps_its_record(self):
        store = seeded_store()
        before = [(b.id, b.status, b.borrower) for b in store.list_all()]

        result = return_book_module.return_book("B001", store)

        self.assertFalse(result.ok)
        self.assertEqual(result.message, "该图书未借出")
        self.assertEqual(
            [(b.id, b.status, b.borrower) for b in store.list_all()], before
        )

    def test_e2_unknown_id_is_rejected_without_adding_a_record(self):
        store = seeded_store()
        before = [(b.id, b.status, b.borrower) for b in store.list_all()]

        return_book_module.return_book("B999", store)

        self.assertEqual(len(store.list_all()), len(before))
        self.assertIsNone(store.find("B999"))

    def test_e3_blank_id_is_treated_as_unknown(self):
        store = seeded_store()

        for book_id in ("", "   "):
            with self.subTest(book_id=book_id):
                result = return_book_module.return_book(book_id, store)
                self.assertFalse(result.ok)
                self.assertEqual(result.message, "图书不存在")

    def test_e4_repeated_failures_have_no_side_effects(self):
        store = seeded_store()
        before = [(b.id, b.status, b.borrower) for b in store.list_all()]

        return_book_module.return_book("B001", store)
        return_book_module.return_book("B999", store)
        return_book_module.return_book("B001", store)

        self.assertEqual(
            [(b.id, b.status, b.borrower) for b in store.list_all()], before
        )

    def test_e5_defaults_to_the_shared_singleton(self):
        shared = book_store_module.book_store
        shared.clear()
        try:
            shared.create("B001", "三体")
            shared.set_status("B001", book_store_module.BORROWED, "u1")

            result = return_book_module.return_book("B001")

            self.assertTrue(result.ok)
            self.assertIsNone(shared.find("B001").borrower)
        finally:
            shared.clear()


if __name__ == "__main__":
    unittest.main()
