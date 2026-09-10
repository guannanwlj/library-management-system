/**
 * FP-005 命令行入口框架的命令契约（TypeScript 侧形状）。
 *
 * 各子命令入口（FP-006 / FP-008 / FP-010）共享同一处理器与注册面形状：
 * 处理器接收子命令之后的全部参数，返回结果文本；注册面把处理器挂到
 * 名字上。此处只描述形状，真正的分发由 Python 侧 `library/cli.py` 负责。
 */

/** 处理器形状：入参为子命令参数，返回结果文本。 */
export type CommandHandler = (args: readonly string[]) => string;

/** 命令行分发面的最小契约（FP-005 §3.2 的 `register`）。 */
export interface CommandRegistrar {
  register(name: string, handler: CommandHandler): unknown;
}
