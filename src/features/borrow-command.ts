/**
 * FP-006 借阅命令入口。
 *
 * 命令行层到借出逻辑的接线：解析 `borrow <bookId> <borrower>` 的两个参数，
 * 校验参数个数与借阅人非空，调用 FP-007 的借出执行，并把结果文本输出。
 * 借出状态变更与合法性判定由 FP-007 负责，本模块只解析、校验与透传。
 */

import { BorrowRuleMessages } from '../rules/borrow-rules.js';
import { bookStore, type BookStore } from '../store/book-store.js';
import { borrow, type BorrowResult } from './borrow-book.js';

/** 借出执行能力（FP-007 契约）；测试可注入假实现。 */
export type BorrowExecutor = (bookId: string, borrower: string) => BorrowResult;

/** FP-005 契约的处理器形状：接收子命令参数，返回结果文本。 */
export type BorrowHandler = (args: readonly string[]) => string;

/** 命令行分发面的最小契约（FP-005 §3.2 的 `register`）。 */
export interface BorrowRegistrar {
  register(name: string, handler: BorrowHandler): unknown;
}

/** 解析后的合法参数：图书编号与借阅人标识。 */
export interface ParsedBorrow {
  readonly bookId: string;
  readonly borrower: string;
}

/** 借阅人标识缺失文案（与 FP-004 契约逐字一致）。 */
export const BORROWER_MISSING_MESSAGE = BorrowRuleMessages.BorrowerMissing;

/**
 * 解析 `borrow` 参数：前两个 token 依次为 `bookId`、`borrower`。
 *
 * 借阅人缺失（参数不足两个）或纯空白时返回 `null`；多余 token 忽略。
 * 借阅人非空时原样返回（不 `trim`，遵守 FP-003 自由文本约定）。
 */
export function parseBorrowArgs(args: readonly string[]): ParsedBorrow | null {
  const bookId = args[0] ?? '';
  const borrower = args[1] ?? '';
  if (borrower.trim() === '') {
    return null;
  }
  return { bookId, borrower };
}

/**
 * 处理一次 `borrow` 子命令：解析 → 校验 → 调用借出执行 → 返回结果文本。
 *
 * 缺参时直接返回「借阅人标识缺失」，**不调用**执行函数；否则逐字返回
 * 执行结果的 `message`（成功为「借阅成功」，失败为 FP-004 错误文案）。
 */
export function handleBorrow(
  args: readonly string[],
  execute: BorrowExecutor,
): string {
  const parsed = parseBorrowArgs(args);
  if (parsed === null) {
    return BORROWER_MISSING_MESSAGE;
  }
  return execute(parsed.bookId, parsed.borrower).message;
}

/**
 * 构造 `borrow` 处理器。
 *
 * @param store 目标集合，默认进程内单例；仅在未注入 `execute` 时用于绑定
 *   默认的 FP-007 借出执行。
 * @param execute 借出执行函数；默认 `(bookId, borrower) => borrow(...)`。
 */
export function createBorrowHandler(
  store: BookStore = bookStore,
  execute?: BorrowExecutor,
): BorrowHandler {
  const run: BorrowExecutor =
    execute ?? ((bookId, borrower) => borrow(bookId, borrower, store));
  return (args) => handleBorrow(args, run);
}

/** 把 `borrow` 处理器注册到分发面，返回处理器本身。 */
export function registerBorrowCommand(
  registrar: BorrowRegistrar,
  store: BookStore = bookStore,
  execute?: BorrowExecutor,
): BorrowHandler {
  const handler = createBorrowHandler(store, execute);
  registrar.register('borrow', handler);
  return handler;
}
