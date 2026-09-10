import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  BookStatus,
  BookStore,
  createBook,
  EMPTY_LIST_MESSAGE,
  formatBookLine,
  formatBookList,
  createListBooksHandler,
  registerListCommand,
  type ListHandler,
  type Book,
} from '../src/index.js';

function seededStore(): BookStore {
  const store = new BookStore();
  store.create('B001', '三体');
  store.create('B002', '活着');
  store.create('B003', '百年孤独');
  return store;
}

/** Minimal registrar that mirrors the FP-005 `register(name, handler)` shape. */
class RecordingRegistrar {
  readonly registrations: Array<{ name: string; handler: ListHandler }> = [];

  register(name: string, handler: ListHandler): ListHandler {
    this.registrations.push({ name, handler });
    return handler;
  }
}

describe('list books - 验收标准', () => {
  it('AC-1: lists the three seeded books, all available', () => {
    const store = seededStore();

    const text = formatBookList(store.listAll());

    assert.equal(
      text,
      ['B001 三体 可借', 'B002 活着 可借', 'B003 百年孤独 可借'].join('\n'),
    );
  });

  it('AC-2: shows a borrowed book as 已借出', () => {
    const store = seededStore();
    store.setStatus('B001', BookStatus.Borrowed, 'u1');

    const text = formatBookList(store.listAll());

    assert.match(text, /^B001 三体 已借出$/m);
    assert.match(text, /^B002 活着 可借$/m);
  });

  it('AC-3: shows a returned book as 可借 again', () => {
    const store = seededStore();
    store.setStatus('B001', BookStatus.Borrowed, 'u1');
    store.setStatus('B001', BookStatus.Available);

    const text = formatBookList(store.listAll());

    assert.match(text, /^B001 三体 可借$/m);
  });

  it('AC-4: reports an empty collection as 暂无图书', () => {
    const store = new BookStore();

    assert.equal(formatBookList(store.listAll()), EMPTY_LIST_MESSAGE);
  });
});

describe('list books - 输出格式', () => {
  it('F-1: formats a single book as "id title status"', () => {
    const book = createBook('B001', '三体');

    assert.equal(formatBookLine(book), 'B001 三体 可借');
  });

  it('F-2: preserves collection order, one line per book', () => {
    const store = new BookStore();
    store.create('B003', '第三');
    store.create('B001', '第一');

    assert.deepEqual(formatBookList(store.listAll()).split('\n'), [
      'B003 第三 可借',
      'B001 第一 可借',
    ]);
  });

  it('F-3: falls back to the raw status for an unknown value', () => {
    const book: Book = {
      ...createBook('B001', '三体'),
      status: 'archived' as BookStatus,
    };

    assert.equal(formatBookLine(book), 'B001 三体 archived');
  });
});

describe('list books - 分发与集成', () => {
  it('I-1: registers a "list" handler on the dispatcher', () => {
    const registrar = new RecordingRegistrar();

    registerListCommand(registrar, seededStore());

    assert.equal(registrar.registrations.length, 1);
    assert.equal(registrar.registrations[0]?.name, 'list');
    assert.equal(typeof registrar.registrations[0]?.handler, 'function');
  });

  it('I-2: the handler reflects the current store contents', () => {
    const store = seededStore();
    const handler = createListBooksHandler(store);

    assert.equal(formatBookList(store.listAll()), handler([]));

    store.setStatus('B002', BookStatus.Borrowed, 'u2');
    assert.match(handler([]), /^B002 活着 已借出$/m);
  });

  it('I-2b: the handler ignores extra arguments', () => {
    const store = seededStore();
    const handler = createListBooksHandler(store);

    assert.equal(handler(['noise', 'more']), handler([]));
  });
});

describe('list books - 边界', () => {
  it('E-1: an empty list formats to the empty message', () => {
    assert.equal(formatBookList([]), EMPTY_LIST_MESSAGE);
    assert.equal(formatBookList([]), '暂无图书');
  });

  it('E-2: an empty store turns non-empty after a book is added', () => {
    const store = new BookStore();
    assert.equal(formatBookList(store.listAll()), EMPTY_LIST_MESSAGE);

    store.create('B001', '三体');

    assert.equal(formatBookList(store.listAll()), 'B001 三体 可借');
  });

  it('E-3: a non-empty store turns empty after clear()', () => {
    const store = seededStore();
    store.clear();

    assert.equal(formatBookList(store.listAll()), EMPTY_LIST_MESSAGE);
  });

  it('E-4: status changes are reflected on the next read', () => {
    const store = seededStore();
    const handler = createListBooksHandler(store);

    store.setStatus('B003', BookStatus.Borrowed, 'u3');
    assert.match(handler([]), /^B003 百年孤独 已借出$/m);

    store.setStatus('B003', BookStatus.Available);
    assert.match(handler([]), /^B003 百年孤独 可借$/m);
  });
});
