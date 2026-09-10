/**
 * FP-007 借出执行与状态变更：借阅主流程的核心执行步骤。
 *
 * 编排「查找 → 规则判定（FP-004）→ 变更状态与借阅人（FP-001 / FP-003）」，
 * 对外暴露 `borrow(bookId, borrower) -> { ok, message }`（任务卡 §3.2）。
 * 参数解析与结果输出由 FP-006 命令入口负责，本模块不做。
 */

import { BookStatus } from '../domain/book.js';
import { bookStore, type BookStore } from '../store/book-store.js';
import {
  BorrowOperation,
  checkBorrowRules,
} from '../rules/borrow-rules.js';

/** 借出成功时的固定文案（任务卡未规定拒绝以外的文案）。 */
export const BORROW_SUCCESS_MESSAGE = '借阅成功';

/** 借出执行结果：`ok` 为唯一判据，`message` 为成功或固定错误文案。 */
export interface BorrowResult {
  readonly ok: boolean;
  readonly message: string;
}

/**
 * 执行一次借出。
 *
 * 先按编号查找并调用 FP-004 判定：不允许则原样返回错误文案，且不触碰
 * 集合；允许则把状态置为 `borrowed`、借阅人置为入参。借阅人自由文本
 * 原样保存（FP-003），合法性由规则层保证。
 *
 * @param bookId 图书编号。
 * @param borrower 借阅人标识；`null` / `undefined` 同样按缺失处理。
 * @param store 目标集合，默认进程内单例；测试可注入隔离集合。
 */
export function borrow(
  bookId: string,
  borrower: string | null | undefined,
  store: BookStore = bookStore,
): BorrowResult {
  const borrowerId = borrower ?? '';
  const decision = checkBorrowRules({
    operation: BorrowOperation.Borrow,
    book: store.find(bookId),
    borrower: borrowerId,
  });

  if (!decision.allowed) {
    return { ok: false, message: decision.message };
  }

  store.setStatus(bookId, BookStatus.Borrowed, borrowerId);
  return { ok: true, message: BORROW_SUCCESS_MESSAGE };
}
