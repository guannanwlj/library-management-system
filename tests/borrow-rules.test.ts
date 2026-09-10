import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  BookStatus,
  BookStore,
  BorrowOperation,
  BorrowRuleMessages,
  checkBorrow,
  checkBorrowRules,
  checkReturn,
} from '../src/index.js';

function seededStore(): BookStore {
  const store = new BookStore();
  store.create('B001', '深入理解计算机系统');
  store.create('B002', '代码大全');
  store.setStatus('B001', BookStatus.Borrowed, 'u1');
  return store;
}

describe('BorrowRules - 验收标准', () => {
  it('AC-1: borrow of a borrowed book is rejected and keeps state', () => {
    const store = seededStore();

    const decision = checkBorrow(store, 'B001', 'u2');

    assert.equal(decision.allowed, false);
    assert.equal(decision.message, '该图书已借出');
    assert.equal(store.find('B001')?.status, BookStatus.Borrowed);
    assert.equal(store.find('B001')?.borrower, 'u1');
  });

  it('AC-2: return of an available book is rejected and keeps state', () => {
    const store = seededStore();

    const decision = checkReturn(store, 'B002');

    assert.equal(decision.allowed, false);
    assert.equal(decision.message, '该图书未借出');
    assert.equal(store.find('B002')?.status, BookStatus.Available);
  });

  it('AC-3: an unknown id is rejected for both operations', () => {
    const store = seededStore();

    const borrow = checkBorrow(store, 'B999', 'u1');
    const returned = checkReturn(store, 'B999');

    assert.equal(borrow.allowed, false);
    assert.equal(borrow.message, '图书不存在');
    assert.equal(returned.allowed, false);
    assert.equal(returned.message, '图书不存在');
  });

  it('AC-4: borrow without a borrower is rejected', () => {
    const store = seededStore();

    const decision = checkBorrow(store, 'B002', null);

    assert.equal(decision.allowed, false);
    assert.equal(decision.message, '借阅人标识缺失');
    assert.equal(store.find('B002')?.status, BookStatus.Available);
  });
});

describe('BorrowRules - 独立验证', () => {
  it('T-1: borrowing an available book with a borrower is allowed', () => {
    const store = seededStore();

    const decision = checkBorrow(store, 'B002', 'u2');

    assert.equal(decision.allowed, true);
    assert.equal(decision.message, null);
  });

  it('T-2: returning a borrowed book is allowed', () => {
    const store = seededStore();

    const decision = checkReturn(store, 'B001');

    assert.equal(decision.allowed, true);
    assert.equal(decision.message, null);
  });

  it('T-3: repeated checks are idempotent', () => {
    const store = seededStore();

    const first = checkBorrow(store, 'B001', 'u2');
    const second = checkBorrow(store, 'B001', 'u2');

    assert.deepEqual(first, second);
  });

  it('T-4: rejections never change the collection', () => {
    const store = seededStore();
    const before = store.listAll();

    checkBorrow(store, 'B001', 'u2');
    checkReturn(store, 'B002');
    checkBorrow(store, 'B999', 'u1');
    checkReturn(store, 'B999');
    checkBorrow(store, 'B002', null);

    assert.deepEqual(store.listAll(), before);
  });

  it('T-5: the convenience wrappers read status via find', () => {
    const store = seededStore();

    assert.deepEqual(
      checkBorrow(store, 'B001', 'u2'),
      checkBorrowRules({
        operation: BorrowOperation.Borrow,
        book: store.find('B001'),
        borrower: 'u2',
      }),
    );
    assert.deepEqual(
      checkReturn(store, 'B001'),
      checkBorrowRules({
        operation: BorrowOperation.Return,
        book: store.find('B001'),
      }),
    );
  });
});

describe('BorrowRules - 借阅人标识缺失', () => {
  it('E-1: undefined borrower is rejected', () => {
    const decision = checkBorrow(seededStore(), 'B002', undefined);

    assert.equal(decision.allowed, false);
    assert.equal(decision.message, '借阅人标识缺失');
  });

  it('E-2: null borrower is rejected', () => {
    const decision = checkBorrow(seededStore(), 'B002', null);

    assert.equal(decision.allowed, false);
    assert.equal(decision.message, '借阅人标识缺失');
  });

  it('E-3: empty and blank borrowers are rejected', () => {
    for (const borrower of ['', '   ', '\t']) {
      const decision = checkBorrow(seededStore(), 'B002', borrower);
      assert.equal(decision.allowed, false, JSON.stringify(borrower));
      assert.equal(decision.message, '借阅人标识缺失');
    }
  });
});

describe('BorrowRules - 判定优先级与边界', () => {
  it('E-4: an unknown id outranks a missing borrower', () => {
    const decision = checkBorrow(seededStore(), 'B999', undefined);

    assert.equal(decision.allowed, false);
    assert.equal(decision.message, '图书不存在');
  });

  it('E-5: an already borrowed book outranks a missing borrower', () => {
    const decision = checkBorrow(seededStore(), 'B001', undefined);

    assert.equal(decision.allowed, false);
    assert.equal(decision.message, '该图书已借出');
  });

  it('E-6: a stale borrower does not make an available book returnable', () => {
    const decision = checkBorrowRules({
      operation: BorrowOperation.Return,
      book: { status: BookStatus.Available, borrower: 'stale' },
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.message, '该图书未借出');
  });

  it('E-7: the borrower does not affect a return decision', () => {
    const decision = checkBorrowRules({
      operation: BorrowOperation.Return,
      book: { status: BookStatus.Borrowed, borrower: 'u1' },
    });

    assert.equal(decision.allowed, true);
  });

  it('E-8: a minimal status object is enough to decide', () => {
    const decision = checkBorrowRules({
      operation: BorrowOperation.Borrow,
      book: { status: BookStatus.Available, borrower: null },
      borrower: 'u1',
    });

    assert.equal(decision.allowed, true);
    assert.equal(decision.message, null);
  });

  it('E-9: a missing book object is rejected', () => {
    const decision = checkBorrowRules({
      operation: BorrowOperation.Borrow,
      book: undefined,
      borrower: 'u1',
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.message, '图书不存在');
  });
});

describe('BorrowRules - 固定文案', () => {
  it('matches the contract messages verbatim', () => {
    assert.equal(BorrowRuleMessages.BookNotFound, '图书不存在');
    assert.equal(BorrowRuleMessages.AlreadyBorrowed, '该图书已借出');
    assert.equal(BorrowRuleMessages.NotBorrowed, '该图书未借出');
    assert.equal(BorrowRuleMessages.BorrowerMissing, '借阅人标识缺失');
  });
});
