/**
 * FP-003 借阅记录模型：借阅关系附着在图书实体上（D4 单册模型），
 * 不单独建借阅记录表。本模块是 `borrower` 字段读写约定的源头。
 *
 * 只负责借阅记录字段本身：读取 / 写入 / 清除。
 * 不流转图书状态（由 FP-007 / FP-009 负责），不校验借阅人是否存在
 * （D3 自由文本），一律原样保存。
 */

import type { Book } from './book.js';

/** 借阅人标识：自由文本；无借阅记录时为 `null`。 */
export type Borrower = string | null;

/** 读取图书上的借阅记录（借阅人标识）。 */
export function readBorrower(book: Pick<Book, 'borrower'>): Borrower {
  return book.borrower;
}

/**
 * 写入借阅记录：原样保存自由文本，不做存在性校验、不做文本规范化。
 * 返回新的 `Book`，不改动入参，也不改动 `status`。
 */
export function withBorrower(book: Book, borrower: string): Book {
  return { ...book, borrower };
}

/** 清除借阅记录（归还）：借阅人置为 `null`。不改动 `status`。 */
export function withoutBorrower(book: Book): Book {
  return { ...book, borrower: null };
}
