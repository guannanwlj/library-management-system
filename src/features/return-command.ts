/**
 * FP-008 归还命令入口。
 *
 * 把 `return <bookId>` 的输入接到 FP-009 的归还执行上：解析第一个 token
 * 作为图书编号 → 调用 `returnBook(bookId)` → 返回结果文案（成功提示或
 * FP-004 的固定错误文案）。本模块只解析与透传，不做任何规则判定或状态
 * 变更（那些由 FP-009 负责），也不实现命令行框架本身（FP-005）。
 */

import { bookStore, type BookStore } from '../store/book-store.js';
import { type CommandHandler, type CommandRegistrar } from './command.js';
import { returnBook } from './return-book.js';

/** FP-005 契约的 `return` 处理器形状。 */
export type ReturnHandler = CommandHandler;

/**
 * 解析 `return` 子命令参数：取第一个 token 作为图书编号。
 *
 * 缺失参数返回空串，交由归还执行判为「图书不存在」；多余参数忽略。
 */
export function parseReturnBookId(args: readonly string[]): string {
  return args[0] ?? '';
}

/**
 * 构造 `return` 处理器：每次调用都执行一次归还并返回其结果文案。
 *
 * @param store 目标集合，默认进程内单例 `bookStore`，测试可注入隔离集合。
 */
export function createReturnCommandHandler(
  store: BookStore = bookStore,
): ReturnHandler {
  return (args) => returnBook(parseReturnBookId(args), store).message;
}

/** 把 `return` 处理器注册到分发面，返回处理器本身。 */
export function registerReturnCommand(
  registrar: CommandRegistrar,
  store: BookStore = bookStore,
): ReturnHandler {
  const handler = createReturnCommandHandler(store);
  registrar.register('return', handler);
  return handler;
}
