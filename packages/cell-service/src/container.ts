import { OutboxEventPublisher }                from '@shared/events';
import { FirestoreCellGroupRepository }       from './infrastructure/repositories/FirestoreCellGroupRepository';
import { FirestoreJoinRequestRepository }     from './infrastructure/repositories/FirestoreJoinRequestRepository';
import { FirestoreCellReportRepository }      from './infrastructure/repositories/FirestoreCellReportRepository';
import { CreateCellGroupUseCase }             from './application/use-cases/CreateCellGroupUseCase';
import { GetCellsUseCase }                    from './application/use-cases/GetCellsUseCase';
import { GetMyCellsUseCase }                  from './application/use-cases/GetMyCellsUseCase';
import { GetCellByIdUseCase }                 from './application/use-cases/GetCellByIdUseCase';
import { UpdateCellGroupUseCase }             from './application/use-cases/UpdateCellGroupUseCase';
import { ArchiveCellGroupUseCase }            from './application/use-cases/ArchiveCellGroupUseCase';
import { DeleteCellGroupUseCase }            from './application/use-cases/DeleteCellGroupUseCase';
import { TransferCellOwnershipUseCase }      from './application/use-cases/TransferCellOwnershipUseCase';
import { AddMembersUseCase }                  from './application/use-cases/AddMembersUseCase';
import { RemoveMemberUseCase }                from './application/use-cases/RemoveMemberUseCase';
import { CreateJoinRequestUseCase }           from './application/use-cases/CreateJoinRequestUseCase';
import { GetJoinRequestsUseCase }             from './application/use-cases/GetJoinRequestsUseCase';
import { ApproveJoinRequestUseCase }          from './application/use-cases/ApproveJoinRequestUseCase';
import { RejectJoinRequestUseCase }           from './application/use-cases/RejectJoinRequestUseCase';
import { FileReportUseCase }                  from './application/use-cases/FileReportUseCase';
import { GetReportsUseCase }                  from './application/use-cases/GetReportsUseCase';
import { GetReportByIdUseCase }               from './application/use-cases/GetReportByIdUseCase';
import { VoidReportUseCase }                  from './application/use-cases/VoidReportUseCase';
import { UpdateCellReportUseCase }            from './application/use-cases/UpdateCellReportUseCase';
import { GetNetworkReportsUseCase }           from './application/use-cases/GetNetworkReportsUseCase';
import { UserServiceClient }                  from './infrastructure/clients/UserServiceClient';
import { CellGroupController }                from './http/controllers/CellGroupController';
import { CellReportController }               from './http/controllers/CellReportController';

// Infrastructure
const cellRepo      = new FirestoreCellGroupRepository();
const joinRepo      = new FirestoreJoinRequestRepository();
const reportRepo    = new FirestoreCellReportRepository();
const outbox        = new OutboxEventPublisher();
const userClient    = new UserServiceClient();

// Cell Group use cases
const createCellUC   = new CreateCellGroupUseCase(cellRepo, outbox);
const getCellsUC     = new GetCellsUseCase(cellRepo);
const getMyCellsUC   = new GetMyCellsUseCase(cellRepo);
const getCellByIdUC  = new GetCellByIdUseCase(cellRepo, userClient);
const updateCellUC   = new UpdateCellGroupUseCase(cellRepo);
const archiveCellUC  = new ArchiveCellGroupUseCase(cellRepo);
const deleteCellUC      = new DeleteCellGroupUseCase(cellRepo);
const transferOwnerUC   = new TransferCellOwnershipUseCase(cellRepo, outbox);
const addMembersUC   = new AddMembersUseCase(cellRepo);
const removeMemberUC = new RemoveMemberUseCase(cellRepo);

// Join Request use cases
const createJoinUC  = new CreateJoinRequestUseCase(cellRepo, joinRepo, outbox);
const getJoinUC     = new GetJoinRequestsUseCase(cellRepo, joinRepo);
const approveJoinUC = new ApproveJoinRequestUseCase(cellRepo, joinRepo, outbox);
const rejectJoinUC  = new RejectJoinRequestUseCase(cellRepo, joinRepo, outbox);

// Cell Report use cases
const fileReportUC   = new FileReportUseCase(cellRepo, reportRepo, outbox);
const getReportsUC   = new GetReportsUseCase(cellRepo, reportRepo);
const getReportByIdUC = new GetReportByIdUseCase(cellRepo, reportRepo);
const voidReportUC      = new VoidReportUseCase(cellRepo, reportRepo, outbox);
const updateReportUC      = new UpdateCellReportUseCase(cellRepo, reportRepo);
const networkReportsUC    = new GetNetworkReportsUseCase(cellRepo, reportRepo);

export const container = {
  cellGroupController: new CellGroupController(
    createCellUC, getCellsUC, getMyCellsUC, getCellByIdUC,
    updateCellUC, archiveCellUC, deleteCellUC, transferOwnerUC, addMembersUC, removeMemberUC,
    createJoinUC, getJoinUC, approveJoinUC, rejectJoinUC,
  ),
  cellReportController: new CellReportController(
    fileReportUC, getReportsUC, getReportByIdUC, voidReportUC, updateReportUC, networkReportsUC,
  ),
};
