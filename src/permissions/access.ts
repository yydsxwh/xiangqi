/**
 * 象棋前端只消费主站下发的能力，不保存谁是站长。
 * 站长身份由主站 getSession() / isAdmin() 决定。
 */
export interface GameCapabilities {
  canEnterBeta: boolean;
  canUseOpenAI: boolean;
}

export const NO_ACCESS: GameCapabilities = {
  canEnterBeta: false,
  canUseOpenAI: false,
};
