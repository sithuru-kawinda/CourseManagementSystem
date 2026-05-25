import { CellGroup, CellState, CellType } from '../entities/CellGroup';

export interface CellGroupListOptions {
  limit:          number;
  cursor?:        string;
  state?:         CellState;
  type?:          CellType;
  area?:          string;
  leaderUid?:     string;
  g12LeaderUid?:  string;   // filter cells by their G12 leader
  search?:        string;
}

export interface CellGroupListResult {
  items:      CellGroup[];
  nextCursor: string | null;
  total:      number;
}

export interface ICellGroupRepository {
  findById(id: string): Promise<CellGroup | null>;
  findByMember(uid: string): Promise<CellGroup[]>;
  findAll(opts: CellGroupListOptions): Promise<CellGroupListResult>;
  create(cell: CellGroup): Promise<void>;
  update(cell: CellGroup): Promise<void>;
  delete(id: string): Promise<void>;
}
