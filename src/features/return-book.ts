/**
 * FP-009 归还执行与状态恢复。
 *
 * 一次真实的归还：按编号查找图书 → 调用 FP-004 的归还规则判定 →
 * 合法时恢复 `available` 并清除借阅记录（FP-003 的 `borrower = null`
 * 约定），返回 `{ ok, message }`；非法时返回固定文案且不改动任何状态。
 *
 * 归还人不与记录的借阅人做一致性校验（D3 自由文本），故本函数不接收
 * 归还人，记录中的借阅人不会阻碍归还。
 */

import { BookStatus } from '../domain/book.js';
import { checkReturn } from '../rules/borrow-rules.js';
import { bookStore, type BookStore } from '../store/book-store.js';

/** 归还成功的固定文案（任务卡只固定拒绝文案，成功文案由本模块给出）。 */
export const RETURN_SUCCESS_MESSAGE = '归还成功';

/** 归还执行结果：`ok` 表示是否完成归还，`message` 为成功/错误文案。 */
export interface ReturnResult {
  readonly ok: boolean;
  readonly message: string;
}

/**
 * 执行一次归还。
 *
 * @param bookId 图书编号；不存在或未借出时返回对应错误。
 * @param store 图书集合，默认进程内单例 `bookStore`，测试可注入隔离集合。
 */
export function returnBook(
  bookId: string,
  store: BookStore = bookStore,
): ReturnResult {
  const decision = checkReturn(store, bookId);
  if (!decision.allowed) {
    return { ok: false, message: decision.message };
  }

  store.setStatus(bookId, BookStatus.Available);
  return { ok: true, message: RETURN_SUCCESS_MESSAGE };
}
