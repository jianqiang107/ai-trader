/** 板块类型 */
export type SectorType = 'concept' | 'industry' | 'region';

/** 板块 */
export interface Sector {
  code: string;
  name: string;
  type: SectorType;
  change_pct: number;
  up_count: number;
  down_count: number;
  net_inflow: number;
  turnover_rate: number;
  representative_stocks: string[];
}
