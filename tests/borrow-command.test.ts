import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  BookStatus,
  BookStore,
  BORROW_SUCCESS_MESSAGE,
  BORROWER_MISSING_MESSAGE,
  bookStore,
  createBorrowHandler,
  handleBorrow,
  parseBorrowArgs,
  registerBorrowCommand,
  type BorrowHandler,
  type BorrowResult,
} from '../src/index.js';

/** Task-card §6 seed: B001 available; B002 borrowed by u1. */
function seededStore(): BookStore {
  const store = new BookStore();
  store.create('B001', '三体');
  store.create('B002', '活着');
  store.setStatus('B002', BookStatus.Borrowed, 'u1');
  return store;
}

/** Fake FP-007 executor that records its calls and returns a canned result. */
function recordingExecutor(result: BorrowResult): {
  calls: Array<[string, string]>;
  execute: (bookId: string, borrower: string) => BorrowResult;
} {
  const calls: Array<[string, string]> = [];
  const execute = (bookId: string, borrower: string): BorrowResult => {
    calls.push([bookId, borrower]);
    return result;
  };
  return { calls, execute };
}

/** Minimal registrar mirroring the FP-005 `register(name, handler)` shape. */
class RecordingRegistrar {
  readonly registrations: Array<{ name: string; handler: BorrowHandler }> = [];

  register(name: string, handler: BorrowHandler): BorrowHandler {
    this.registrations.push({ name, handler });
    return handler;
  }
}

describe('borrow command - 验收标准', () => {
  it('AC-1: borrow B001 u1 triggers the borrow and reports success', () => {
    const store = seededStore();
    const handler = createBorrowHandler(store);

    const text = handler(['B001', 'u1']);

    assert.equal(text, BORROW_SUCCESS_MESSAGE);
    assert.equal(store.find('B001')?.status, BookStatus.Borrowed);
    assert.equal(store.find('B001')?.borrower, 'u1');
  });

  it('AC-2: borrow B001 (missing borrower) is rejected without borrowing', () => {
    const store = seededStore();
    const handler = createBorrowHandler(store);

    const text = handler(['B001']);

    assert.equal(text, '借阅人标识缺失');
    assert.equal(store.find('B001')?.status, BookStatus.Available);
    assert.equal(store.find('B001')?.borrower, null);
  });

  it('AC-3: borrow B002 u1 passes the already-borrowed rejection through', () => {
    const handler = createBorrowHandler(seededStore());

    assert.equal(handler(['B002', 'u1']), '该图书已借出');
  });
});

describe('borrow command - 参数解析', () => {
  it('P-1: splits the first two tokens into bookId and borrower', () => {
    assert.deepEqual(parseBorrowArgs(['B001', 'u1']), {
      bookId: 'B001',
      borrower: 'u1',
    });
  });

  it('P-2: one argument means the borrower is missing', () => {
    assert.equal(parseBorrowArgs(['B001']), null);
  });

  it('P-3: no arguments means the borrower is missing', () => {
    assert.equal(parseBorrowArgs([]), null);
  });

  it('P-4: a blank borrower is treated as missing', () => {
    for (const blank of ['', '   ', '\t']) {
      assert.equal(parseBorrowArgs(['B001', blank]), null, blank);
    }
  });

  it('P-5: extra tokens are ignored', () => {
    assert.deepEqual(parseBorrowArgs(['B001', 'u1', 'extra']), {
      bookId: 'B001',
      borrower: 'u1',
    });
  });

  it('P-6: the borrower is kept verbatim (no trimming)', () => {
    assert.deepEqual(parseBorrowArgs(['B001', '  u1 ']), {
      bookId: 'B001',
      borrower: '  u1 ',
    });
  });

  it('P-7: an empty bookId is still parsed when a borrower is present', () => {
    assert.deepEqual(parseBorrowArgs(['', 'u1']), {
      bookId: '',
      borrower: 'u1',
    });
  });
});

describe('borrow command - 处理与透传', () => {
  it('T-1: calls the executor with the parsed pair and returns its message', () => {
    const fake = recordingExecutor({ ok: true, message: '借阅成功' });

    const text = handleBorrow(['B001', 'u1'], fake.execute);

    assert.deepEqual(fake.calls, [['B001', 'u1']]);
    assert.equal(text, '借阅成功');
  });

  it('T-2: a missing borrower never reaches the executor', () => {
    for (const args of [[], ['B001'], ['B001', '  ']]) {
      const fake = recordingExecutor({ ok: true, message: '借阅成功' });
      assert.equal(handleBorrow(args, fake.execute), '借阅人标识缺失');
      assert.deepEqual(fake.calls, []);
    }
  });

  it('T-3: a rejection message is passed through unchanged', () => {
    const fake = recordingExecutor({ ok: false, message: '该图书已借出' });

    assert.equal(handleBorrow(['B002', 'u1'], fake.execute), '该图书已借出');
  });

  it('T-4: an unknown id rejection is passed through unchanged', () => {
    const fake = recordingExecutor({ ok: false, message: '图书不存在' });

    assert.equal(handleBorrow(['B999', 'u1'], fake.execute), '图书不存在');
  });

  it('T-5: the fixed missing-borrower text matches the shared contract', () => {
    assert.equal(BORROWER_MISSING_MESSAGE, '借阅人标识缺失');
  });
});

describe('borrow command - 注册与默认绑定', () => {
  it('T-6: registerBorrowCommand mounts a "borrow" handler', () => {
    const registrar = new RecordingRegistrar();

    const handler = registerBorrowCommand(registrar, seededStore());

    assert.equal(registrar.registrations.length, 1);
    assert.equal(registrar.registrations[0]?.name, 'borrow');
    assert.equal(registrar.registrations[0]?.handler, handler);
    assert.equal(typeof handler, 'function');
  });

  it('E-7: the default handler reads and writes the shared singleton', () => {
    bookStore.clear();
    try {
      bookStore.create('B001', '三体');

      assert.equal(createBorrowHandler()(['B001', 'u1']), '借阅成功');
      assert.equal(bookStore.find('B001')?.borrower, 'u1');
    } finally {
      bookStore.clear();
    }
  });
});

describe('borrow command - 边界', () => {
  it('E-1: blank borrowers are rejected across whitespace variants', () => {
    for (const blank of ['', ' ', '\t', '\n']) {
      const store = seededStore();
      const text = createBorrowHandler(store)(['B001', blank]);
      assert.equal(text, '借阅人标识缺失', JSON.stringify(blank));
      assert.equal(store.find('B001')?.status, BookStatus.Available);
    }
  });

  it('E-2: zero or one arguments are rejected', () => {
    const store = seededStore();
    const handler = createBorrowHandler(store);

    assert.equal(handler([]), '借阅人标识缺失');
    assert.equal(handler(['B001']), '借阅人标识缺失');
  });

  it('E-3: an unknown id (and a blank id) passes through 图书不存在', () => {
    const store = seededStore();

    assert.equal(createBorrowHandler(store)(['B999', 'u1']), '图书不存在');
    assert.equal(createBorrowHandler(store)(['', 'u1']), '图书不存在');
  });

  it('E-4: extra tokens are ignored by the real handler', () => {
    const store = seededStore();

    assert.equal(createBorrowHandler(store)(['B001', 'u1', 'extra']), '借阅成功');
    assert.equal(store.find('B001')?.borrower, 'u1');
  });

  it('E-5: a free-text borrower is stored verbatim', () => {
    const store = seededStore();
    const borrower = '  u1 / #图书馆 <读者>  ';

    assert.equal(createBorrowHandler(store)(['B001', borrower]), '借阅成功');
    assert.equal(store.find('B001')?.borrower, borrower);
  });

  it('E-6: a rejected command leaves the collection untouched', () => {
    const store = seededStore();
    const before = store.listAll();

    createBorrowHandler(store)(['B001']);
    createBorrowHandler(store)(['B001', '   ']);
    createBorrowHandler(store)([]);

    assert.deepEqual(store.listAll(), before);
  });
});
