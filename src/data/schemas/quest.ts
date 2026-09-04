import { oneOf, type Schema } from '../validate';

export const QUEST_TYPES = ['hunt', 'capture', 'investigation', 'gathering', 'survival', 'multiHunt'] as const;
export type QuestType = (typeof QUEST_TYPES)[number];

export interface QuestRewardMaterial {
  itemId: string;
  count: number;
  /** 0〜1。クリア報酬として付与される確率。 */
  chance: number;
}

export interface QuestDefinition {
  id: string;
  type: QuestType;
  name: string;
  description: string;
  fieldId: string;
  target: { monsterId: string };
  timeLimitSeconds: number;
  /** この回数戦闘不能になると失敗。 */
  maxDowns: number;
  /** 討伐後、リザルトへ移るまでの猶予（剥ぎ取り時間）。 */
  returnDelaySeconds: number;
  rewards: QuestRewardMaterial[];
  /** 出発時に支給される消耗品（クエスト内でのみ有効、持ち越さない）。 */
  supplies: { itemId: string; count: number }[];
}

export const questSchema = {
  id: 'string',
  type: oneOf(QUEST_TYPES),
  name: 'string',
  description: 'string',
  fieldId: 'string',
  target: { monsterId: 'string' },
  timeLimitSeconds: 'number',
  maxDowns: 'number',
  returnDelaySeconds: 'number',
  rewards: [{ itemId: 'string', count: 'number', chance: 'number' }],
  supplies: [{ itemId: 'string', count: 'number' }],
} as const satisfies Schema;
