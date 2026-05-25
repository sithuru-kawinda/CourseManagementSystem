import { v4 as uuidv4 }                    from 'uuid';
import { Request, Response, NextFunction } from 'express';
import { getStorage }                       from 'firebase-admin/storage';
import { AuthenticatedRequest }             from '@shared/auth-middleware';
import { fromZodError, createHttpError }    from '@shared/errors';
import { sendSuccess, sendPaginated }       from '@shared/response';
import { logger }                           from '@shared/logger';
import { FileReportUseCase }                from '../../application/use-cases/FileReportUseCase';
import { GetReportsUseCase }                from '../../application/use-cases/GetReportsUseCase';
import { GetReportByIdUseCase }             from '../../application/use-cases/GetReportByIdUseCase';
import { VoidReportUseCase }                from '../../application/use-cases/VoidReportUseCase';
import { UpdateCellReportUseCase }          from '../../application/use-cases/UpdateCellReportUseCase';
import { GetNetworkReportsUseCase }         from '../../application/use-cases/GetNetworkReportsUseCase';
import { fileReportSchema, voidReportSchema, listReportsSchema, updateReportSchema } from '../validators/reportValidator';
import { CellType } from '../../domain/entities/CellGroup';
import { config }   from '../../config';

// ── helper: upload files to Firebase Storage, return browser-loadable URLs ──
// Uses a per-file download token embedded in custom metadata so the URL works
// in <img> tags without credentials, even with Uniform Bucket-Level Access on.
async function uploadPhotosToStorage(cellId: string, files: Express.Multer.File[]): Promise<string[]> {
  if (files.length === 0) return [];
  const bucket    = getStorage().bucket();
  const timestamp = Date.now();
  const urls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const f       = files[i];
    const ext     = f.mimetype === 'image/png' ? 'png' : 'jpg';
    const path    = `cells/${cellId}/report-photos/${timestamp}-${i + 1}.${ext}`;
    const fileRef = bucket.file(path);
    const token   = uuidv4();
    await fileRef.save(f.buffer, {
      contentType: f.mimetype,
      resumable:   false,
      metadata: {
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });
    const encodedPath = encodeURIComponent(path);
    urls.push(
      `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${encodedPath}?alt=media&token=${token}`,
    );
  }
  return urls;
}

export class CellReportController {
  constructor(
    private readonly fileUC:       FileReportUseCase,
    private readonly getReportsUC: GetReportsUseCase,
    private readonly getOneUC:     GetReportByIdUseCase,
    private readonly voidUC:       VoidReportUseCase,
    private readonly updateUC:        UpdateCellReportUseCase,
    private readonly networkReportsUC: GetNetworkReportsUseCase,
  ) {}

  listReports = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = listReportsSchema.safeParse(req.query);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid, roles } = (req as AuthenticatedRequest).principal;
      const result = await this.getReportsUC.execute(req.params.id, parsed.data, uid, roles);
      sendPaginated(res, result.items, result.nextCursor, result.total);
    } catch (err) { next(err); }
  };

  /**
   * POST /cells/:id/reports
   * Accepts multipart/form-data:
   *   data:   JSON string of the report fields
   *   photos: 0-10 JPEG/PNG images (optional, max 5 MB each)
   *
   * Photos are uploaded to Firebase Storage automatically.
   * The resulting URLs are stored as photoUrls[] on the report.
   */
  fileReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientReqId = (req.headers['x-idempotency-key'] ?? '') as string;

      // Upload any attached photos first
      const files     = (req.files ?? []) as Express.Multer.File[];
      const photoUrls = await uploadPhotosToStorage(req.params.id, files);

      // Merge uploaded URLs into the body (override any photoUrls already in the JSON)
      const body = {
        ...(req.body as Record<string, unknown>),
        clientReqId,
        photoUrls,
      };

      const parsed = fileReportSchema.safeParse(body);
      if (!parsed.success) return next(fromZodError(parsed.error));

      const { uid, roles } = (req as AuthenticatedRequest).principal;
      const requestId      = (req.headers['x-request-id'] as string) ?? '';

      const { report, isNew } = await this.fileUC.execute(
        req.params.id,
        { ...parsed.data, cellType: (parsed.data.cellType ?? 'g12') as CellType },
        uid,
        roles,
        requestId,
      );

      if (photoUrls.length > 0)
        logger.info({ cellId: req.params.id, count: photoUrls.length }, 'Report photos saved');

      sendSuccess(res, report, isNew ? 201 : 200);
    } catch (err) { next(err); }
  };

  getReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid, roles } = (req as AuthenticatedRequest).principal;
      const report = await this.getOneUC.execute(req.params.id, req.params.rid, uid, roles);
      sendSuccess(res, report);
    } catch (err) { next(err); }
  };

  voidReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = voidReportSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid, roles } = (req as AuthenticatedRequest).principal;
      const requestId      = (req.headers['x-request-id'] as string) ?? '';
      const report = await this.voidUC.execute(
        req.params.id, req.params.rid, parsed.data.reason, uid, roles, requestId,
      );
      sendSuccess(res, report);
    } catch (err) { next(err); }
  };

  /**
   * PATCH /cells/:id/reports/:rid
   * Edit a cell report within 24 hours of filing.
   * Only the original filer or super_admin can edit.
   * Voided reports cannot be edited.
   */
  updateReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = updateReportSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));

      const { uid, roles } = (req as AuthenticatedRequest).principal;
      const report = await this.updateUC.execute(
        req.params.id,
        req.params.rid,
        parsed.data,
        uid,
        roles,
      );
      sendSuccess(res, report);
    } catch (err) { next(err); }
  };

  /**
   * GET /cells/network/reports
   * Returns reports from all cells in the caller's G12 network.
   * G12 sees reports from cells where g12LeaderUid === callerUid.
   * Leader sees their own cell's reports. Admin sees all cells.
   */
  networkReports = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = listReportsSchema.safeParse(req.query);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid, roles } = (req as AuthenticatedRequest).principal;
      const result = await this.networkReportsUC.execute(parsed.data, uid, roles);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  /**
   * POST /cells/:id/report-photos
   * Standalone photo upload — use when you want to upload photos separately
   * before filing the report. Returns { photoUrls: string[] }.
   */
  uploadPhotos = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const files = (req.files ?? []) as Express.Multer.File[];
      if (files.length === 0)
        return next(createHttpError(400, 'VALIDATION_ERROR', 'No photos provided.'));

      const photoUrls = await uploadPhotosToStorage(req.params.id, files);
      logger.info({ cellId: req.params.id, count: photoUrls.length }, 'Standalone report photos uploaded');
      sendSuccess(res, { photoUrls }, 201);
    } catch (err) { next(err); }
  };
}
