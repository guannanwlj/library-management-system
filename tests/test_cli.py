import io
import unittest

from library import cli


class RecordingHandler:
    """Fake handler that records the args it was called with."""

    def __init__(self, result="OK"):
        self.calls = []
        self.result = result

    def __call__(self, args):
        self.calls.append(list(args))
        return self.result


class DispatchTests(unittest.TestCase):
    def setUp(self):
        self.dispatcher = cli.CommandDispatcher()
        self.borrow = RecordingHandler("OK-BORROW")
        self.ret = RecordingHandler("OK-RETURN")
        self.lst = RecordingHandler("OK-LIST")
        self.dispatcher.register("borrow", self.borrow)
        self.dispatcher.register("return", self.ret)
        self.dispatcher.register("list", self.lst)

    def test_borrow_is_dispatched_with_arguments(self):
        result = self.dispatcher.dispatch(["borrow", "B001", "u1"])
        self.assertEqual(self.borrow.calls, [["B001", "u1"]])
        self.assertEqual(result, "OK-BORROW")

    def test_return_is_dispatched_with_argument(self):
        result = self.dispatcher.dispatch(["return", "B001"])
        self.assertEqual(self.ret.calls, [["B001"]])
        self.assertEqual(result, "OK-RETURN")

    def test_list_is_dispatched_without_arguments(self):
        result = self.dispatcher.dispatch(["list"])
        self.assertEqual(self.lst.calls, [[]])
        self.assertEqual(result, "OK-LIST")

    def test_extra_arguments_are_passed_through_untouched(self):
        self.dispatcher.dispatch(["borrow", "B001", "u1", "extra"])
        self.assertEqual(self.borrow.calls, [["B001", "u1", "extra"]])

    def test_handler_result_text_is_returned_unchanged(self):
        self.dispatcher.register("borrow", RecordingHandler("该图书已借出"))
        result = self.dispatcher.dispatch(["borrow", "B002", "u1"])
        self.assertEqual(result, "该图书已借出")

    def test_unknown_command_returns_unknown_message(self):
        result = self.dispatcher.dispatch(["hack", "x"])
        self.assertEqual(result, cli.UNKNOWN_COMMAND_MESSAGE)
        self.assertEqual(self.borrow.calls, [])
        self.assertEqual(self.ret.calls, [])
        self.assertEqual(self.lst.calls, [])

    def test_empty_input_returns_unknown_message(self):
        self.assertEqual(self.dispatcher.dispatch([]), cli.UNKNOWN_COMMAND_MESSAGE)

    def test_registered_but_absent_command_returns_unknown_message(self):
        dispatcher = cli.CommandDispatcher()
        dispatcher.register("borrow", RecordingHandler())
        self.assertEqual(dispatcher.dispatch(["return", "B001"]), cli.UNKNOWN_COMMAND_MESSAGE)


class RegistrationTests(unittest.TestCase):
    def test_handler_is_reachable_after_registration(self):
        dispatcher = cli.CommandDispatcher()
        handler = RecordingHandler()
        dispatcher.register("borrow", handler)
        dispatcher.dispatch(["borrow", "B001", "u1"])
        self.assertEqual(handler.calls, [["B001", "u1"]])

    def test_reregistration_overrides_previous_handler(self):
        dispatcher = cli.CommandDispatcher()
        first = RecordingHandler("first")
        second = RecordingHandler("second")
        dispatcher.register("borrow", first)
        dispatcher.register("borrow", second)
        self.assertEqual(dispatcher.dispatch(["borrow", "B001", "u1"]), "second")
        self.assertEqual(first.calls, [])
        self.assertEqual(second.calls, [["B001", "u1"]])

    def test_register_rejects_non_callable_handler(self):
        with self.assertRaises(TypeError):
            cli.CommandDispatcher().register("borrow", 123)

    def test_register_rejects_empty_name(self):
        with self.assertRaises(ValueError):
            cli.CommandDispatcher().register("", RecordingHandler())

    def test_module_register_mounts_to_default_dispatcher(self):
        handler = RecordingHandler("mounted")
        cli.register("borrow", handler)
        try:
            self.assertEqual(cli.dispatch(["borrow", "B001", "u1"]), "mounted")
            self.assertEqual(handler.calls, [["B001", "u1"]])
        finally:
            cli.register("borrow", cli.create_placeholder_handler())


class OutputTests(unittest.TestCase):
    def test_run_writes_and_returns_result_text(self):
        dispatcher = cli.CommandDispatcher()
        dispatcher.register("list", RecordingHandler("暂无图书"))
        out = io.StringIO()
        result = dispatcher.run(["list"], out=out)
        self.assertEqual(result, "暂无图书")
        self.assertEqual(out.getvalue(), "暂无图书\n")


class PlaceholderTests(unittest.TestCase):
    def test_default_dispatcher_accepts_all_three_subcommands(self):
        dispatcher = cli.create_default_dispatcher()
        for argv in (["borrow", "B001", "u1"], ["return", "B001"], ["list"]):
            with self.subTest(argv=argv):
                self.assertEqual(dispatcher.dispatch(argv), cli.PLACEHOLDER_MESSAGE)

    def test_default_placeholder_can_be_overridden(self):
        dispatcher = cli.create_default_dispatcher()
        dispatcher.register("borrow", RecordingHandler("real"))
        self.assertEqual(dispatcher.dispatch(["borrow", "B001", "u1"]), "real")

    def test_framework_has_no_authentication_api(self):
        dispatcher = cli.CommandDispatcher()
        for forbidden in ("login", "authenticate", "authorize", "check_permission"):
            self.assertFalse(hasattr(dispatcher, forbidden), forbidden)

    def test_dispatch_requires_no_credentials(self):
        dispatcher = cli.CommandDispatcher()
        handler = RecordingHandler()
        dispatcher.register("return", handler)
        self.assertEqual(dispatcher.dispatch(["return", "B001"]), "OK")
        self.assertEqual(handler.calls, [["B001"]])


if __name__ == "__main__":
    unittest.main()
