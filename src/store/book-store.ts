import {
  BookStatus,
  BookNotFoundError,
  DuplicateBookIdError,
  createBook,
  type Book,
} from '../domain/book.js';

function clone(book: Book): Book {
  return { ...book };
}

/**
 * 进程内图书集合，按 `id` 索引。
 * 只提供数据读写，不做借阅/归还的业务校验；见 docs/designs/FP-001。
 */
export class BookStore {
  private readonly books = new Map<string, Book>();

  /** 新增图书；编号重复或字段非法时抛错。 */
  add(book: Book): Book {
    const normalized = createBook(book.id, book.title, {
      status: book.status,
      borrower: book.borrower,
    });

    if (this.books.has(normalized.id)) {
      throw new DuplicateBookIdError(normalized.id);
    }

    this.books.set(normalized.id, normalized);
    return clone(normalized);
  }

  /** 便捷新增：以编号 + 名称建一本默认可借的图书。 */
  create(id: string, title: string): Book {
    return this.add(createBook(id, title));
  }

  /** 返回全部图书，按插入顺序。 */
  listAll(): Book[] {
    return [...this.books.values()].map(clone);
  }

  /** 按编号查找；不存在返回 `undefined`。 */
  find(id: string): Book | undefined {
    const book = this.books.get(id);
    return book ? clone(book) : undefined;
  }

  /** 更新状态与借阅人；编号不存在时抛 `BookNotFoundError`。 */
  setStatus(
    id: string,
    status: BookStatus,
    borrower: string | null = null,
  ): Book {
    const book = this.books.get(id);
    if (!book) {
      throw new BookNotFoundError(id);
    }

    book.status = status;
    book.borrower = status === BookStatus.Available ? null : (borrower ?? null);
    return clone(book);
  }

  /** 清空集合（重置/测试用）。 */
  clear(): void {
    this.books.clear();
  }
}

/** 进程内单例集合，供各功能任务共享同一份内存数据。 */
export const bookStore = new BookStore();
