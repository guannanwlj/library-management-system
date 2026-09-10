import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  BookNotFoundError,
  BookStatus,
  BookStore,
  createBook,
  readBorrower,
  withBorrower,
  withoutBorrower,
} from '../src/index.js';

function borrowedStore(): BookStore {
  const store = new BookStore();
  store.add(
    createBook('B001', '测试图书', {
      status: BookStatus.Borrowed,
      borrower: 'u1',
    }),
  );
  return store;
}

describe('BorrowRecord - 验收标准', () => {
  it('AC-1: reads the borrower recorded on a borrowed book', () => {
    const store = borrowedStore();

    const book = store.find('B001');

    assert.equal(book?.borrower, 'u1');
    assert.equal(readBorrower(book!), 'u1');
  });

  it('AC-2: clearing the record sets the borrower to null', () => {
    const store = borrowedStore();

    store.clearBorrower('B001');

    assert.equal(store.find('B001')?.borrower, null);
  });

  it('AC-3: unknown free-text borrower is stored verbatim', () => {
    const store = new BookStore();
    store.create('B001', '测试图书');

    store.setBorrower('B001', 'ghost-user-42');

    assert.equal(store.find('B001')?.borrower, 'ghost-user-42');
  });
});

describe('BorrowRecord - 独立验证', () => {
  it('T-1: a written borrower can be read back', () => {
    const store = new BookStore();
    store.create('B001', '测试图书');

    store.setBorrower('B001', 'u7');

    assert.equal(readBorrower(store.find('B001')!), 'u7');
  });

  it('T-2: a cleared borrower reads back as null', () => {
    const store = borrowedStore();

    store.clearBorrower('B001');

    assert.equal(readBorrower(store.find('B001')!), null);
  });

  it('T-3: a nonexistent identifier is stored verbatim', () => {
    const store = new BookStore();
    store.create('B001', '测试图书');

    store.setBorrower('B001', 'does-not-exist');

    assert.equal(store.find('B001')?.borrower, 'does-not-exist');
  });
});

describe('BorrowRecord - 领域纯函数', () => {
  it('withBorrower returns a new book without mutating the original', () => {
    const book = createBook('B001', '测试图书');

    const updated = withBorrower(book, 'u1');

    assert.equal(updated.borrower, 'u1');
    assert.equal(book.borrower, null);
    assert.notEqual(updated, book);
  });

  it('withoutBorrower returns a new book with no borrower', () => {
    const book = createBook('B001', '测试图书', {
      status: BookStatus.Borrowed,
      borrower: 'u1',
    });

    const updated = withoutBorrower(book);

    assert.equal(updated.borrower, null);
    assert.equal(book.borrower, 'u1');
    assert.notEqual(updated, book);
  });

  it('readBorrower returns null for a book with no record', () => {
    assert.equal(readBorrower(createBook('B001', '测试图书')), null);
  });
});

describe('BorrowRecord - 边界与错误路径', () => {
  it('E-1: setBorrower throws for an unknown id', () => {
    const store = borrowedStore();

    assert.throws(() => store.setBorrower('NOPE', 'u1'), BookNotFoundError);
  });

  it('E-2: clearBorrower throws for an unknown id', () => {
    const store = borrowedStore();

    assert.throws(() => store.clearBorrower('NOPE'), BookNotFoundError);
  });

  it('E-3: writing again replaces the single borrower', () => {
    const store = borrowedStore();

    store.setBorrower('B001', 'u2');

    assert.equal(store.find('B001')?.borrower, 'u2');
  });

  it('E-4: free text keeps its whitespace and symbols verbatim', () => {
    const store = new BookStore();
    store.create('B001', '测试图书');
    const freeText = '  u1 / #图书馆 <读者>  ';

    store.setBorrower('B001', freeText);

    assert.equal(store.find('B001')?.borrower, freeText);
  });

  it('E-5: clearing an already-empty record is idempotent', () => {
    const store = new BookStore();
    store.create('B001', '测试图书');

    store.clearBorrower('B001');

    assert.equal(store.find('B001')?.borrower, null);
  });

  it('E-6: mutating the returned book does not affect the store', () => {
    const store = borrowedStore();

    const returned = store.setBorrower('B001', 'u2');
    returned.borrower = 'hacker';

    assert.equal(store.find('B001')?.borrower, 'u2');
  });

  it('E-7: an available book with no record reads back null', () => {
    const store = new BookStore();
    store.create('B001', '测试图书');

    assert.equal(readBorrower(store.find('B001')!), null);
  });

  it('E-8: writing and clearing leave status untouched', () => {
    const availableStore = new BookStore();
    availableStore.create('B001', '测试图书');

    availableStore.setBorrower('B001', 'u1');
    assert.equal(availableStore.find('B001')?.status, BookStatus.Available);

    availableStore.clearBorrower('B001');
    assert.equal(availableStore.find('B001')?.status, BookStatus.Available);

    const borrowed = borrowedStore();
    borrowed.setBorrower('B001', 'u2');
    assert.equal(borrowed.find('B001')?.status, BookStatus.Borrowed);

    borrowed.clearBorrower('B001');
    assert.equal(borrowed.find('B001')?.status, BookStatus.Borrowed);
  });
});
