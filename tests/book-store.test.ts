import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  BookStatus,
  BookStore,
  bookStore,
  createBook,
  DuplicateBookIdError,
  InvalidBookError,
  BookNotFoundError,
} from '../src/index.js';

function seededStore(): BookStore {
  const store = new BookStore();
  store.create('B001', '深入理解计算机系统');
  store.create('B002', '代码大全');
  return store;
}

describe('BookStore - 验收标准', () => {
  it('AC-1: listAll returns the two seeded books', () => {
    const store = seededStore();

    const books = store.listAll();

    assert.equal(books.length, 2);
    assert.deepEqual(
      books.map((book) => [book.id, book.title, book.status]),
      [
        ['B001', '深入理解计算机系统', BookStatus.Available],
        ['B002', '代码大全', BookStatus.Available],
      ],
    );
  });

  it('AC-2: setStatus updates status and borrower', () => {
    const store = seededStore();

    store.setStatus('B001', BookStatus.Borrowed, 'u1');

    const book = store.find('B001');
    assert.equal(book?.status, BookStatus.Borrowed);
    assert.equal(book?.borrower, 'u1');
  });

  it('AC-3: status persists across reads in the same process', () => {
    const store = seededStore();
    store.setStatus('B001', BookStatus.Borrowed, 'u1');

    const first = store.find('B001');
    const second = store.find('B001');
    const inList = store.listAll().find((book) => book.id === 'B001');

    assert.equal(first?.status, BookStatus.Borrowed);
    assert.equal(second?.status, BookStatus.Borrowed);
    assert.equal(inList?.status, BookStatus.Borrowed);
    assert.equal(inList?.borrower, 'u1');
  });
});

describe('BookStore - 独立验证', () => {
  it('T-1: an empty store lists no books', () => {
    const store = new BookStore();

    assert.deepEqual(store.listAll(), []);
  });

  it('T-2: a book is findable after being added', () => {
    const store = new BookStore();
    const added = store.add(createBook('B001', '测试图书'));

    assert.deepEqual(store.find('B001'), added);
  });

  it('T-3: repeated reads stay consistent after an update', () => {
    const store = seededStore();
    store.setStatus('B002', BookStatus.Borrowed, 'u2');

    assert.deepEqual(store.find('B002'), store.find('B002'));
  });

  it('T-4: a created book defaults to available with no borrower', () => {
    const store = new BookStore();

    const book = store.create('B001', '测试图书');

    assert.equal(book.status, BookStatus.Available);
    assert.equal(book.borrower, null);
    assert.equal(book.id, 'B001');
    assert.equal(book.title, '测试图书');
  });
});

describe('BookStore - 边界与错误路径', () => {
  it('E-1: find returns undefined for an unknown id', () => {
    const store = seededStore();

    assert.equal(store.find('NOPE'), undefined);
  });

  it('E-2: setStatus throws for an unknown id', () => {
    const store = seededStore();

    assert.throws(
      () => store.setStatus('NOPE', BookStatus.Borrowed, 'u1'),
      BookNotFoundError,
    );
  });

  it('E-3: add rejects a duplicate id', () => {
    const store = seededStore();

    assert.throws(
      () => store.add(createBook('B001', '重复编号')),
      DuplicateBookIdError,
    );
  });

  it('E-4: add/create rejects a blank id', () => {
    const store = new BookStore();

    assert.throws(() => store.add(createBook('   ', '空编号')), InvalidBookError);
    assert.throws(() => store.add(createBook('', '空编号')), InvalidBookError);
    assert.throws(() => store.create('', '空编号'), InvalidBookError);
    assert.throws(
      () =>
        store.add({
          id: '  ',
          title: '空编号',
          status: BookStatus.Available,
          borrower: null,
        }),
      InvalidBookError,
    );
  });

  it('E-5: returning a book clears the borrower', () => {
    const store = seededStore();
    store.setStatus('B001', BookStatus.Borrowed, 'u1');

    store.setStatus('B001', BookStatus.Available, 'u1');

    const book = store.find('B001');
    assert.equal(book?.status, BookStatus.Available);
    assert.equal(book?.borrower, null);
  });

  it('E-6: mutating a returned book does not affect the store', () => {
    const store = seededStore();

    const returned = store.find('B001');
    assert.ok(returned);
    returned.status = BookStatus.Borrowed;
    returned.borrower = 'hacker';

    const stored = store.find('B001');
    assert.equal(stored?.status, BookStatus.Available);
    assert.equal(stored?.borrower, null);
  });

  it('E-7: listAll preserves insertion order', () => {
    const store = new BookStore();
    store.create('B003', '第三');
    store.create('B001', '第一');
    store.create('B002', '第二');

    assert.deepEqual(
      store.listAll().map((book) => book.id),
      ['B003', 'B001', 'B002'],
    );
  });
});

describe('BookStore - 数据不变式与归一化', () => {
  it('N-1: an available book never keeps a borrower', () => {
    const store = new BookStore();

    const added = store.add(
      createBook('B001', '测试图书', {
        status: BookStatus.Available,
        borrower: 'stale',
      }),
    );

    assert.equal(added.borrower, null);
    assert.equal(store.find('B001')?.borrower, null);
  });

  it('N-2: a borrowed book keeps its borrower across reads', () => {
    const store = new BookStore();

    store.add(
      createBook('B001', '测试图书', {
        status: BookStatus.Borrowed,
        borrower: 'u9',
      }),
    );

    assert.equal(store.find('B001')?.status, BookStatus.Borrowed);
    assert.equal(store.find('B001')?.borrower, 'u9');
  });

  it('N-3: id and title are trimmed when a book is stored', () => {
    const store = new BookStore();

    const book = store.create('  B001  ', '  测试图书  ');

    assert.equal(book.id, 'B001');
    assert.equal(book.title, '测试图书');
    assert.equal(store.find('B001')?.title, '测试图书');
  });

  it('N-4: a blank title is rejected', () => {
    const store = new BookStore();

    assert.throws(() => store.create('B001', '   '), InvalidBookError);
    assert.throws(
      () =>
        store.add({
          id: 'B001',
          title: '',
          status: BookStatus.Available,
          borrower: null,
        }),
      InvalidBookError,
    );
  });

  it('N-5: clear empties the collection', () => {
    const store = seededStore();

    store.clear();

    assert.deepEqual(store.listAll(), []);
    assert.equal(store.find('B001'), undefined);
  });
});

describe('BookStore - 进程内单例', () => {
  it('exposes one shared instance across module imports', async () => {
    const [first, second] = await Promise.all([
      import('../src/index.js'),
      import('../src/index.js'),
    ]);

    assert.equal(first.bookStore, second.bookStore);
    assert.equal(first.bookStore, bookStore);
  });

  it('keeps state on the shared singleton until cleared', () => {
    bookStore.clear();
    bookStore.create('B001', '单例图书');

    assert.equal(bookStore.find('B001')?.title, '单例图书');

    bookStore.clear();
    assert.deepEqual(bookStore.listAll(), []);
  });
});
