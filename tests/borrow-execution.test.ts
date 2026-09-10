import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  BookStatus,
  BookStore,
  BORROW_SUCCESS_MESSAGE,
  borrow,
  createBook,
  type BorrowResult,
} from '../src/index.js';

function seededStore(): BookStore {
  const store = new BookStore();
  store.create('B001', '三体');
  store.add(
    createBook('B002', '活着', {
      status: BookStatus.Borrowed,
      borrower: 'u1',
    }),
  );
  return store;
}

describe('FP-007 借出执行 - 验收标准', () => {
  it('AC-1: borrowing an available book sets status and borrower', () => {
    const store = seededStore();

    const result = borrow('B001', 'u1', store);

    assert.equal(result.ok, true);
    const book = store.find('B001');
    assert.equal(book?.status, BookStatus.Borrowed);
    assert.equal(book?.borrower, 'u1');
  });

  it('AC-2: re-borrowing a borrowed book is rejected and keeps state', () => {
    const store = seededStore();

    const result = borrow('B002', 'u1', store);

    assert.equal(result.ok, false);
    assert.equal(result.message, '该图书已借出');
    const book = store.find('B002');
    assert.equal(book?.status, BookStatus.Borrowed);
    assert.equal(book?.borrower, 'u1');
  });

  it('AC-3: borrowing an unknown id is rejected with 图书不存在', () => {
    const store = seededStore();

    const result = borrow('B999', 'u1', store);

    assert.equal(result.ok, false);
    assert.equal(result.message, '图书不存在');
    assert.equal(store.find('B999'), undefined);
  });

  it('AC-4: borrowing without a borrower is rejected and keeps state', () => {
    const store = seededStore();

    const result = borrow('B001', '', store);

    assert.equal(result.ok, false);
    assert.equal(result.message, '借阅人标识缺失');
    assert.equal(store.find('B001')?.status, BookStatus.Available);
    assert.equal(store.find('B001')?.borrower, null);
  });
});

describe('FP-007 借出执行 - 独立验证', () => {
  it('T-1: the result exposes a boolean ok and a string message', () => {
    const success = borrow('B001', 'u1', seededStore());
    const failure = borrow('B999', 'u1', seededStore());

    assert.deepEqual(Object.keys(success).sort(), ['message', 'ok']);
    assert.equal(typeof success.ok, 'boolean');
    assert.equal(typeof success.message, 'string');
    assert.equal(typeof failure.ok, 'boolean');
    assert.equal(typeof failure.message, 'string');
  });

  it('T-2: a successful borrow is visible through find and listAll', () => {
    const store = seededStore();

    borrow('B001', 'u1', store);

    assert.equal(store.find('B001')?.status, BookStatus.Borrowed);
    assert.equal(store.find('B001')?.borrower, 'u1');
    const listed = store.listAll().find((book) => book.id === 'B001');
    assert.equal(listed?.status, BookStatus.Borrowed);
    assert.equal(listed?.borrower, 'u1');
  });

  it('T-3: free-text borrower is stored verbatim (no trim)', () => {
    const store = seededStore();
    const borrower = '  u1 / #图书馆 <读者>  ';

    borrow('B001', borrower, store);

    assert.equal(store.find('B001')?.borrower, borrower);
  });

  it('T-4: every rejection leaves the collection untouched', () => {
    const store = seededStore();
    const before = store.listAll();

    borrow('B002', 'u2', store);
    borrow('B999', 'u1', store);
    borrow('B001', '', store);

    assert.deepEqual(store.listAll(), before);
  });
});

describe('FP-007 借出执行 - 边界与错误路径', () => {
  it('E-1: a null borrower is rejected', () => {
    const store = seededStore();

    const result = borrow('B001', null, store);

    assert.equal(result.ok, false);
    assert.equal(result.message, '借阅人标识缺失');
    assert.equal(store.find('B001')?.status, BookStatus.Available);
  });

  it('E-2: an undefined borrower is rejected', () => {
    const store = seededStore();

    const result = borrow('B001', undefined, store);

    assert.equal(result.ok, false);
    assert.equal(result.message, '借阅人标识缺失');
    assert.equal(store.find('B001')?.status, BookStatus.Available);
  });

  it('E-3: a blank borrower is rejected', () => {
    for (const borrower of ['   ', '\t', '\n']) {
      const store = seededStore();
      const result = borrow('B001', borrower, store);
      assert.equal(result.ok, false, JSON.stringify(borrower));
      assert.equal(result.message, '借阅人标识缺失');
      assert.equal(store.find('B001')?.status, BookStatus.Available);
    }
  });

  it('E-4: an unknown id outranks a missing borrower', () => {
    const result = borrow('B999', undefined, seededStore());

    assert.equal(result.ok, false);
    assert.equal(result.message, '图书不存在');
  });

  it('E-5: an already borrowed book outranks a missing borrower', () => {
    const result = borrow('B002', undefined, seededStore());

    assert.equal(result.ok, false);
    assert.equal(result.message, '该图书已借出');
  });

  it('E-6: a second borrow keeps the first borrower', () => {
    const store = seededStore();
    borrow('B001', 'u1', store);

    const result = borrow('B001', 'u2', store);

    assert.equal(result.ok, false);
    assert.equal(result.message, '该图书已借出');
    assert.equal(store.find('B001')?.borrower, 'u1');
  });

  it('E-7: a returned book can be borrowed again', () => {
    const store = seededStore();
    borrow('B001', 'u1', store);
    store.setStatus('B001', BookStatus.Available);

    const result = borrow('B001', 'u2', store);

    assert.equal(result.ok, true);
    assert.equal(store.find('B001')?.status, BookStatus.Borrowed);
    assert.equal(store.find('B001')?.borrower, 'u2');
  });

  it('E-8: the success message is the fixed contract text', () => {
    assert.equal(BORROW_SUCCESS_MESSAGE, '借阅成功');

    const result: BorrowResult = borrow('B001', 'u1', seededStore());
    assert.equal(result.message, BORROW_SUCCESS_MESSAGE);
  });
});
