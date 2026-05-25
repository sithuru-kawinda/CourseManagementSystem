import { getFirestore }              from 'firebase-admin/firestore';
import { CellGroup, CellGroupProps } from '../../domain/entities/CellGroup';
import { ICellGroupRepository,
         CellGroupListOptions,
         CellGroupListResult }       from '../../domain/repositories/ICellGroupRepository';

function toEntity(id: string, data: Omit<CellGroupProps, 'id'>): CellGroup {
  return new CellGroup({ ...data, id });
}

export class FirestoreCellGroupRepository implements ICellGroupRepository {
  private readonly col = getFirestore().collection('cell_groups');

  async findById(id: string): Promise<CellGroup | null> {
    const snap = await this.col.doc(id).get();
    if (!snap.exists) return null;
    return toEntity(snap.id, snap.data() as Omit<CellGroupProps, 'id'>);
  }

  async findByMember(uid: string): Promise<CellGroup[]> {
    const snap = await this.col
      .where('members', 'array-contains', uid)
      .get();
    return snap.docs.map(d => toEntity(d.id, d.data() as Omit<CellGroupProps, 'id'>));
  }

  async findAll(opts: CellGroupListOptions): Promise<CellGroupListResult> {
    let q = this.col as FirebaseFirestore.Query;

    if (opts.state)     q = q.where('state',     '==', opts.state);
    if (opts.type)      q = q.where('type',      '==', opts.type);
    if (opts.area)      q = q.where('area',      '==', opts.area);
    if (opts.leaderUid)    q = q.where('leaderUid',    '==', opts.leaderUid);
    if (opts.g12LeaderUid) q = q.where('g12LeaderUid', '==', opts.g12LeaderUid);

    const total = (await q.count().get()).data().count;
    q = q.orderBy('createdAt', 'desc').limit(opts.limit);

    if (opts.cursor) {
      const cs = await this.col.doc(opts.cursor).get();
      if (cs.exists) q = q.startAfter(cs);
    }

    const snap  = await q.get();
    const items = snap.docs.map(d => toEntity(d.id, d.data() as Omit<CellGroupProps, 'id'>));
    const last  = snap.docs[snap.docs.length - 1];
    return { items, nextCursor: snap.docs.length === opts.limit && last ? last.id : null, total };
  }

  async create(cell: CellGroup): Promise<void> {
    const { id, ...doc } = { ...cell } as CellGroupProps;
    await this.col.doc(id).set(doc);
  }

  async update(cell: CellGroup): Promise<void> {
    const { id, ...doc } = { ...cell } as CellGroupProps;
    await this.col.doc(id).update(doc as Record<string, unknown>);
  }

  async delete(id: string): Promise<void> {
    await this.col.doc(id).delete();
  }
}
