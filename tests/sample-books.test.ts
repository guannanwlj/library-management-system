import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  BookStatus,
  BookStore,
  bookStore,
  initializeSampleBooks,
  SAMPLE_BOOKS,
} from '../src/index.js';

const EXPECTED = [
  { id: 'B001', title: '三体' },
  { id: 'B002', title: '活着' },
  { id: 'B003', title: '百年孤独' },
] as const;

describe('FP-002 样例图书初始化 - 验收标准', () => {
  it('AC-1: seeds the three sample books as available', () => {
    const store = new BookStore();

    initializeSampleBooks(store);

    const books = store.listAll();
    assert.equal(books.length, 3);
    for (const expected of EXPECTED) {
      const book = store.find(expected.id);
      assert.ok(book, `expected ${expected.id} to be seeded`);
      assert.equal(book.status, BookStatus.Available);
      assert.equal(book.borrower, null);
    }
  });

  it('AC-2: sample books expose their id and title', () => {
    const store = new BookStore();

    initializeSampleBooks(store);

    for (const expected of EXPECTED) {
      const book = store.find(expected.id);
      assert.equal(book?.id, expected.id);
      assert.equal(book?.title, expected.title);
    }
  });
});

describe('FP-002 样例图书初始化 - 独立验证', () => {
  it('T-1: the seeded collection holds exactly three books', () => {
    const store = new BookStore();

    initializeSampleBooks(store);

    assert.deepEqual(
      store.listAll().map((book) => book.id),
      EXPECTED.map((expected) => expected.id),
    );
  });

  it('T-2: every sample book starts available with no borrower', () => {
    const store = new BookStore();

    initializeSampleBooks(store);

    for (const book of store.listAll()) {
      assert.equal(book.status, BookStatus.Available);
      assert.equal(book.borrower, null);
    }
  });

  it('T-3: the sample manifest matches the §3.1 contract', () => {
    assert.deepEqual(SAMPLE_BOOKS, EXPECTED);
  });
});

describe('FP-002 样例图书初始化 - 边界与错误路径', () => {
  it('E-1: initialization is idempotent', () => {
    const store = new BookStore();

    initializeSampleBooks(store);
    initializeSampleBooks(store);

    assert.equal(store.listAll().length, 3);
  });

  it('E-2: an existing sample keeps its state', () => {
    const store = new BookStore();
    store.create('B001', '三体');
    store.setStatus('B001', BookStatus.Borrowed, 'u1');

    initializeSampleBooks(store);

    const book = store.find('B001');
    assert.equal(book?.status, BookStatus.Borrowed);
    assert.equal(book?.borrower, 'u1');
  });

  it('E-3: only missing samples are added', () => {
    const store = new BookStore();
    store.create('B002', '自定义书名');

    initializeSampleBooks(store);

    assert.equal(store.listAll().length, 3);
    assert.equal(store.find('B002')?.title, '自定义书名');
    assert.equal(store.find('B001')?.title, '三体');
    assert.equal(store.find('B003')?.title, '百年孤独');
  });

  it('E-4: the return value lists only newly added books', () => {
    const store = new BookStore();

    const first = initializeSampleBooks(store);
    const second = initializeSampleBooks(store);

    assert.deepEqual(
      first.map((book) => book.id),
      EXPECTED.map((expected) => expected.id),
    );
    assert.deepEqual(second, []);
  });

  it('E-5: the sample manifest is frozen', () => {
    assert.equal(Object.isFrozen(SAMPLE_BOOKS), true);
    for (const book of SAMPLE_BOOKS) {
      assert.equal(Object.isFrozen(book), true);
    }
    assert.throws(() => {
      (SAMPLE_BOOKS[0] as { id: string }).id = 'X';
    }, TypeError);
  });

  it('E-6: initialization defaults to the shared singleton', () => {
    bookStore.clear();
    try {
      initializeSampleBooks();

      assert.equal(bookStore.find('B001')?.title, '三体');
      assert.equal(bookStore.listAll().length, 3);
    } finally {
      bookStore.clear();
    }
  });
});
