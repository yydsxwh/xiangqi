export const ROLES = ['SUPER_ADMIN', 'USER', 'ANONYMOUS'] as const;
export type Role = (typeof ROLES)[number];

/** 站长可以使用 OpenAI。普通用户和未登录用户不可以。 */
export function canUseOpenAI(role: Role): boolean {
  return role === 'SUPER_ADMIN';
}
