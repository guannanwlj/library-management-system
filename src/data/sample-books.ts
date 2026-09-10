import { type BookStore, bookStore } from '../store/book-store.js';
import { type Book } from '../domain/book.js';

/** 样例图书种子：任务卡 §3.1 固定清单，只含编号与名称。 */
export interface SampleBook {
  readonly id: string;
  readonly title: string;
}

/**
 * 系统内置样例图书（B001《三体》、B002《活着》、B003《百年孤独》）。
 * 状态与借阅人由 `BookStore.create` 的默认值给出（`available` / `null`）。
 */
export const SAMPLE_BOOKS: readonly SampleBook[] = Object.freeze(
  [
    { id: 'B001', title: '三体' },
    { id: 'B002', title: '活着' },
    { id: 'B003', title: '百年孤独' },
  ].map((book) => Object.freeze(book)),
);

/**
 * 启动初始化：把样例图书写入内存集合，初始全部可借。
 *
 * 幂等：已存在的编号会被跳过，既不重复插入，也不覆盖运行期状态。
 * 默认写入进程内单例 `bookStore`，也可传入隔离集合用于测试。
 *
 * @returns 本次实际新增的图书（已存在的样例不计入）。
 */
export function initializeSampleBooks(store: BookStore = bookStore): Book[] {
  const added: Book[] = [];
  for (const sample of SAMPLE_BOOKS) {
    if (store.find(sample.id)) {
      continue;
    }
    added.push(store.create(sample.id, sample.title));
  }
  return added;
}
