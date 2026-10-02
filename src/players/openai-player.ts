/**
 * 旧名字。新代码用 CloudAIPlayer。
 * 保留导出，避免已经编进对局快照的调用方立刻断开。
 */
export { CloudAIPlayer as OpenAIPlayer, type CloudAiMoveTransport as OpenAIMoveTransport } from './cloud-ai-player.ts';
