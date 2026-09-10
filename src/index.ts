export {
  BookStatus,
  BookNotFoundError,
  DuplicateBookIdError,
  InvalidBookError,
  createBook,
  type Book,
  type CreateBookOptions,
} from './domain/book.js';
export {
  readBorrower,
  withBorrower,
  withoutBorrower,
  type Borrower,
} from './domain/borrow-record.js';
export { BookStore, bookStore } from './store/book-store.js';
export {
  SAMPLE_BOOKS,
  initializeSampleBooks,
  type SampleBook,
} from './data/sample-books.js';
export {
  BorrowOperation,
  BorrowRuleMessages,
  checkBorrow,
  checkBorrowRules,
  checkReturn,
  type BookLookup,
  type BorrowRuleDecision,
  type BorrowRuleInput,
  type BorrowRuleMessage,
  type RuleBook,
} from './rules/borrow-rules.js';
export {
  EMPTY_LIST_MESSAGE,
  formatBookLine,
  formatBookList,
  createListBooksHandler,
  registerListCommand,
  type CommandRegistrar,
  type ListHandler,
} from './features/list-books.js';
export {
  BORROW_SUCCESS_MESSAGE,
  borrow,
  type BorrowResult,
} from './features/borrow-book.js';
