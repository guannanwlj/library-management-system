/**
 * FP-004 借阅状态规则与错误反馈。
 *
 * 把「什么操作合法、不合法时提示什么」集中成一处的纯判定逻辑，供借出
 * 执行（FP-007）与归还执行（FP-009）调用。本模块只判定，不修改任何
 * 图书状态或借阅记录；状态变更由调用方在判定为允许后自行执行。
 */

import { BookStatus, type Book } from '../domain/book.js';

/** 规则判定的操作类型：借阅 / 归还。 */
export enum BorrowOperation {
  Borrow = 'borrow',
  Return = 'return',
}

/** 固定错误文案（任务卡 §3.1 契约，逐字为准）。 */
export const BorrowRuleMessages = {
  /** 编号不存在（借阅或归还）。 */
  BookNotFound: '图书不存在',
  /** 对已借出图书借阅。 */
  AlreadyBorrowed: '该图书已借出',
  /** 对可借图书归还。 */
  NotBorrowed: '该图书未借出',
  /** 借阅人标识缺失（借阅）。 */
  BorrowerMissing: '借阅人标识缺失',
} as const;

export type BorrowRuleMessage =
  (typeof BorrowRuleMessages)[keyof typeof BorrowRuleMessages];

/**
 * 判定所需的最简图书视图：只看当前状态与借阅人。
 * 完整的 `Book` 天然满足该结构，§6 的 Mock 也可直接构造。
 */
export type RuleBook = Pick<Book, 'status' | 'borrower'>;

/** 「按编号读取图书」能力，结构上即 `BookStore.find(id)`。 */
export interface BookLookup {
  find(id: string): RuleBook | undefined;
}

/** 判定结果：允许时不带文案，拒绝时带固定错误文案。 */
export type BorrowRuleDecision =
  | { readonly allowed: true; readonly message: null }
  | { readonly allowed: false; readonly message: BorrowRuleMessage };

export interface BorrowRuleInput {
  readonly operation: BorrowOperation;
  /** 图书查找结果；`undefined` 表示编号不存在。 */
  readonly book: RuleBook | undefined;
  /** 借阅人标识；仅借阅操作使用。 */
  readonly borrower?: string | null;
}

const ALLOWED: BorrowRuleDecision = { allowed: true, message: null };

function reject(message: BorrowRuleMessage): BorrowRuleDecision {
  return { allowed: false, message };
}

/** 缺失口径：`null` / `undefined` / 空 / 纯空白均视为未提供。 */
function isBorrowerMissing(borrower: string | null | undefined): boolean {
  return borrower == null || borrower.trim() === '';
}

/**
 * 判定一次借阅或归还是否合法。
 *
 * 判定优先级：存在性 → 状态 → 借阅人标识。
 * 纯函数：不读取也不修改任何外部集合。
 */
export function checkBorrowRules({
  operation,
  book,
  borrower,
}: BorrowRuleInput): BorrowRuleDecision {
  if (!book) {
    return reject(BorrowRuleMessages.BookNotFound);
  }

  if (operation === BorrowOperation.Borrow) {
    if (book.status === BookStatus.Borrowed) {
      return reject(BorrowRuleMessages.AlreadyBorrowed);
    }
    if (isBorrowerMissing(borrower)) {
      return reject(BorrowRuleMessages.BorrowerMissing);
    }
    return ALLOWED;
  }

  if (book.status === BookStatus.Available) {
    return reject(BorrowRuleMessages.NotBorrowed);
  }
  return ALLOWED;
}

/** 按编号读取状态后判定借阅。 */
export function checkBorrow(
  store: BookLookup,
  id: string,
  borrower: string | null | undefined,
): BorrowRuleDecision {
  return checkBorrowRules({
    operation: BorrowOperation.Borrow,
    book: store.find(id),
    borrower: borrower ?? null,
  });
}

/** 按编号读取状态后判定归还。 */
export function checkReturn(store: BookLookup, id: string): BorrowRuleDecision {
  return checkBorrowRules({
    operation: BorrowOperation.Return,
    book: store.find(id),
  });
}
