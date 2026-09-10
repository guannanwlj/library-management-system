/**
 * FP-001 图书实体：编号、名称、状态、借阅人。
 * 纯数据模型，不包含借阅/归还的业务规则（由 FP-004/007/009 负责）。
 */

/** 图书状态：可借 / 已借出。 */
export enum BookStatus {
  Available = 'available',
  Borrowed = 'borrowed',
}

export interface Book {
  /** 图书编号（D7 系统图书编号），唯一、非空。 */
  readonly id: string;
  /** 图书名称，非空。 */
  readonly title: string;
  /** 当前状态，新建默认 `available`。 */
  status: BookStatus;
  /** 借阅人标识；`available` 时为 `null`，`borrowed` 时为借阅人。 */
  borrower: string | null;
}

export interface CreateBookOptions {
  status?: BookStatus;
  borrower?: string | null;
}

/** 图书编号/名称为空时抛出。 */
export class InvalidBookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBookError';
  }
}

/** 按编号找不到图书时抛出。 */
export class BookNotFoundError extends Error {
  constructor(id: string) {
    super(`Book not found: ${id}`);
    this.name = 'BookNotFoundError';
  }
}

/** 编号已存在时抛出。 */
export class DuplicateBookIdError extends Error {
  constructor(id: string) {
    super(`Duplicate book id: ${id}`);
    this.name = 'DuplicateBookIdError';
  }
}

/**
 * 构造一本图书，集中做字段级校验与归一化。
 * 数据不变式：`available` 时借阅人恒为 `null`。
 */
export function createBook(
  id: string,
  title: string,
  options: CreateBookOptions = {},
): Book {
  const normalizedId = id.trim();
  const normalizedTitle = title.trim();

  if (normalizedId === '') {
    throw new InvalidBookError('Book id must be a non-empty string');
  }
  if (normalizedTitle === '') {
    throw new InvalidBookError('Book title must be a non-empty string');
  }

  const status = options.status ?? BookStatus.Available;
  const borrower =
    status === BookStatus.Available ? null : (options.borrower ?? null);

  return { id: normalizedId, title: normalizedTitle, status, borrower };
}
