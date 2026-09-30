import type { Side } from './types.ts';

/** 给不懂记谱的人看的一句说明。不参与规则判断。 */
export function explainPlain(notation: string, side: Side): string {
  if (notation.length < 4) return notation;
  const piece = notation[0] ?? '';
  const fromFile = notation[1] ?? '';
  const verb = notation[2] ?? '';
  const dest = notation.slice(3);
  const who = side === 'red' ? '红方' : '黑方';
  const place = (token: string) => (token === '五' || token === '5' ? '中路' : `${token}路`);
  if (verb === '平') return `${who}的${piece}从${fromFile}路横移到${place(dest)}`;
  if (verb === '进' || verb === '退') {
    const direction = verb === '进' ? '向前' : '向后';
    const diagonal = '马傌馬仕士相象'.includes(piece);
    if (diagonal) return `${who}的${piece}从${fromFile}路${direction}走到${place(dest)}`;
    return `${who}的${piece}从${fromFile}路${direction}${dest}`;
  }
  return `${who} ${notation}`;
}
