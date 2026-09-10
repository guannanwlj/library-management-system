import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  BookStatus,
  BookStore,
  bookStore,
  RETURN_SUCCESS_MESSAGE,
  returnBook,
} from '../src/index.js';

function seededStore(): BookStore {
  const store = new BookStore();
  store.create('B001', '三体');
  store.create('B002', '活着');
  store.setStatus('B002', BookStatus.Borrowed, 'u1');
  return store;
}

describe('return book - 验收标准', () => {
  it('AC-1: returns a borrowed book and clears its borrower', () => {
    const store = seededStore();

    const result = returnBook('B002', store);

    assert.deepEqual(result, { ok: true, message: RETURN_SUCCESS_MESSAGE });
    const book = store.find('B002');
    assert.equal(book?.status, BookStatus.Available);
    assert.equal(book?.borrower, null);
  });

  it('AC-2: rejects returning an available book without changing state', () => {
    const store = seededStore();

    const result = returnBook('B001', store);

    assert.deepEqual(result, { ok: false, message: '该图书未借出' });
    const book = store.find('B001');
    assert.equal(book?.status, BookStatus.Available);
    assert.equal(book?.borrower, null);
  });

  it('AC-3: rejects an unknown book id', () => {
    const store = seededStore();

    const result = returnBook('B999', store);

    assert.deepEqual(result, { ok: false, message: '图书不存在' });
    assert.equal(store.find('B999'), undefined);
  });

  it('AC-4: does not compare the returner with the recorded borrower', () => {
    const store = seededStore();

    const result = returnBook('B002', store);

    assert.equal(result.ok, true);
    assert.equal(store.find('B002')?.borrower, null);
  });
});

describe('return book - 独立验证', () => {
  it('T-1: success carries the fixed success message', () => {
    const store = seededStore();

    assert.deepEqual(returnBook('B002', store), {
      ok: true,
      message: RETURN_SUCCESS_MESSAGE,
    });
  });

  it('T-2: failures carry the FP-004 messages verbatim', () => {
    const store = seededStore();

    assert.equal(returnBook('B001', store).message, '该图书未借出');
    assert.equal(returnBook('B999', store).message, '图书不存在');
  });

  it('T-3: a returned book shows as available in the listing', () => {
    const store = seededStore();

    returnBook('B002', store);

    const listed = store.listAll().find((book) => book.id === 'B002');
    assert.equal(listed?.status, BookStatus.Available);
    assert.equal(listed?.borrower, null);
  });

  it('T-4: returning twice is rejected the second time', () => {
    const store = seededStore();

    const first = returnBook('B002', store);
    const second = returnBook('B002', store);

    assert.equal(first.ok, true);
    assert.deepEqual(second, { ok: false, message: '该图书未借出' });
  });

  it('T-5: returning one book leaves the others untouched', () => {
    const store = seededStore();
    const before = store.find('B001');

    returnBook('B002', store);

    assert.deepEqual(store.find('B001'), before);
  });
});

describe('return book - 边界与错误路径', () => {
  it('E-1: an available book is rejected and keeps its record', () => {
    const store = seededStore();
    const before = store.listAll();

    const result = returnBook('B001', store);

    assert.equal(result.ok, false);
    assert.equal(result.message, '该图书未借出');
    assert.deepEqual(store.listAll(), before);
  });

  it('E-2: an unknown id is rejected without adding a record', () => {
    const store = seededStore();
    const before = store.listAll();

    returnBook('B999', store);

    assert.deepEqual(store.listAll(), before);
  });

  it('E-3: a blank id is treated as unknown', () => {
    const store = seededStore();

    assert.deepEqual(returnBook('   ', store), {
      ok: false,
      message: '图书不存在',
    });
    assert.deepEqual(returnBook('', store), {
      ok: false,
      message: '图书不存在',
    });
  });

  it('E-4: repeated failures have no side effects', () => {
    const store = seededStore();
    const before = store.listAll();

    returnBook('B001', store);
    returnBook('B999', store);
    returnBook('B001', store);

    assert.deepEqual(store.listAll(), before);
  });

  it('E-5: the result always has a boolean ok and a string message', () => {
    const store = seededStore();

    for (const result of [returnBook('B002', store), returnBook('B001', store)]) {
      assert.equal(typeof result.ok, 'boolean');
      assert.equal(typeof result.message, 'string');
      assert.notEqual(result.message, '');
    }
  });

  it('E-6: defaults to the shared singleton store', () => {
    bookStore.clear();
    try {
      bookStore.create('B001', '三体');
      bookStore.setStatus('B001', BookStatus.Borrowed, 'u1');

      const result = returnBook('B001');

      assert.equal(result.ok, true);
      assert.equal(bookStore.find('B001')?.borrower, null);
    } finally {
      bookStore.clear();
    }
  });

  it('E-7: does not mutate the stored book object through the result', () => {
    const store = seededStore();

    const result = returnBook('B002', store);
    (result as { message: string }).message = 'tampered';

    assert.equal(store.find('B002')?.status, BookStatus.Available);
    assert.equal(store.find('B002')?.borrower, null);
  });
});
