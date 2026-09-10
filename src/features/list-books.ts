import { BookStatus, type Book } from '../domain/book.js';
import { type BookStore } from '../store/book-store.js';

/** 空集合提示文案（任务卡 §3.2 输出格式契约）。 */
export const EMPTY_LIST_MESSAGE = '暂无图书';

/** 状态展示标签：`available` → 可借、`borrowed` → 已借出。 */
const STATUS_LABELS: Record<BookStatus, string> = {
  [BookStatus.Available]: '可借',
  [BookStatus.Borrowed]: '已借出',
};

/** FP-005 契约的处理器形状：接收子命令参数，返回结果文本。 */
export type ListHandler = (args: readonly string[]) => string;

/** 命令行分发面的最小契约（FP-005 §3.2 的 `register`）。 */
export interface CommandRegistrar {
  register(name: string, handler: ListHandler): unknown;
}

/** 格式化单本图书为「编号 名称 状态」；未知状态原样回退。 */
export function formatBookLine(book: Book): string {
  const label = STATUS_LABELS[book.status] ?? book.status;
  return `${book.id} ${book.title} ${label}`;
}

/** 逐行格式化全部图书；空集合返回「暂无图书」。 */
export function formatBookList(books: readonly Book[]): string {
  if (books.length === 0) {
    return EMPTY_LIST_MESSAGE;
  }
  return books.map(formatBookLine).join('\n');
}

/**
 * 构造 `list` 处理器：每次调用都读取 `listAll()`，因此状态变化
 * 与集合增删会在下一次查看时即时反映，不做缓存。
 */
export function createListBooksHandler(store: BookStore): ListHandler {
  return () => formatBookList(store.listAll());
}

/** 把 `list` 处理器注册到分发面，返回处理器本身。 */
export function registerListCommand(
  registrar: CommandRegistrar,
  store: BookStore,
): ListHandler {
  const handler = createListBooksHandler(store);
  registrar.register('list', handler);
  return handler;
}
