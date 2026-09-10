import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  BookStatus,
  BookStore,
  bookStore,
  RETURN_SUCCESS_MESSAGE,
  createReturnCommandHandler,
  parseReturnBookId,
  registerReturnCommand,
  type ReturnHandler,
} from '../src/index.js';

function seededStore(): BookStore {
  const store = new BookStore();
  store.create('B001', '三体');
  store.create('B002', '活着');
  store.setStatus('B002', BookStatus.Borrowed, 'u1');
  return store;
}

/** Minimal registrar that mirrors the FP-005 `register(name, handler)` shape. */
class RecordingRegistrar {
  readonly registrations: Array<{ name: string; handler: ReturnHandler }> = [];

  register(name: string, handler: ReturnHandler): ReturnHandler {
    this.registrations.push({ name, handler });
    return handler;
  }
}

describe('return command - 验收标准', () => {
  it('AC-1: triggers a return and reports success', () => {
    const store = seededStore();
    const handler = createReturnCommandHandler(store);

    const text = handler(['B002']);

    assert.equal(text, RETURN_SUCCESS_MESSAGE);
    assert.equal(text, '归还成功');
    assert.equal(store.find('B002')?.status, BookStatus.Available);
    assert.equal(store.find('B002')?.borrower, null);
  });

  it('AC-2: passes through the rejection for an available book', () => {
    const store = seededStore();

    const text = createReturnCommandHandler(store)(['B001']);

    assert.equal(text, '该图书未借出');
    assert.equal(store.find('B001')?.status, BookStatus.Available);
  });

  it('AC-3: reports a missing book as 图书不存在', () => {
    const store = seededStore();

    const text = createReturnCommandHandler(store)(['B999']);

    assert.equal(text, '图书不存在');
    assert.equal(store.find('B999'), undefined);
  });
});

describe('return command - 参数解析', () => {
  it('P-1: takes the first token as the book id', () => {
    assert.equal(parseReturnBookId(['B002']), 'B002');
    assert.equal(parseReturnBookId(['B002', 'noise']), 'B002');
  });

  it('P-2: a missing argument parses to the empty id', () => {
    assert.equal(parseReturnBookId([]), '');
  });

  it('P-3: extra arguments are ignored by the handler', () => {
    const withExtra = createReturnCommandHandler(seededStore());
    const single = createReturnCommandHandler(seededStore());

    assert.equal(withExtra(['B002', 'extra']), single(['B002']));
  });
});

describe('return command - 结果透传与输出', () => {
  it('O-1..O-3: the output is exactly the FP-009 message', () => {
    for (const [id, expected] of [
      ['B001', '该图书未借出'],
      ['B999', '图书不存在'],
    ] as const) {
      const store = seededStore();
      assert.equal(createReturnCommandHandler(store)([id]), expected);
    }
  });

  it('O-4: a second return of the same book is rejected', () => {
    const store = seededStore();
    const handler = createReturnCommandHandler(store);

    assert.equal(handler(['B002']), '归还成功');
    assert.equal(handler(['B002']), '该图书未借出');
  });

  it('O-5: missing argument is treated as unknown by the executor', () => {
    const store = seededStore();

    assert.equal(createReturnCommandHandler(store)([]), '图书不存在');
  });
});

describe('return command - 分发与集成', () => {
  it('I-1: registers a "return" handler on the dispatcher', () => {
    const registrar = new RecordingRegistrar();

    registerReturnCommand(registrar, seededStore());

    assert.equal(registrar.registrations.length, 1);
    assert.equal(registrar.registrations[0]?.name, 'return');
    assert.equal(typeof registrar.registrations[0]?.handler, 'function');
  });

  it('I-2: the registered handler reflects the injected store', () => {
    const registrar = new RecordingRegistrar();
    const store = seededStore();

    registerReturnCommand(registrar, store);
    const handler = registrar.registrations[0]?.handler;
    assert.ok(handler);

    assert.equal(handler(['B002']), '归还成功');
    assert.equal(handler(['B002']), '该图书未借出');
  });
});

describe('return command - 边界与错误路径', () => {
  it('E-1: an empty argument list is rejected without side effects', () => {
    const store = seededStore();
    const before = store.listAll();

    assert.equal(createReturnCommandHandler(store)([]), '图书不存在');
    assert.deepEqual(store.listAll(), before);
  });

  it('E-2: blank ids are treated as unknown', () => {
    const store = seededStore();

    for (const id of ['', '   ']) {
      assert.equal(createReturnCommandHandler(store)([id]), '图书不存在');
    }
  });

  it('E-4: repeated failures have no side effects', () => {
    const store = seededStore();
    const before = store.listAll();
    const handler = createReturnCommandHandler(store);

    handler(['B001']);
    handler(['B999']);
    handler(['B001']);

    assert.deepEqual(store.listAll(), before);
  });

  it('E-5: defaults to the shared singleton store', () => {
    bookStore.clear();
    try {
      bookStore.create('B001', '三体');
      bookStore.setStatus('B001', BookStatus.Borrowed, 'u1');

      assert.equal(createReturnCommandHandler()(['B001']), '归还成功');
      assert.equal(bookStore.find('B001')?.borrower, null);
    } finally {
      bookStore.clear();
    }
  });
});
