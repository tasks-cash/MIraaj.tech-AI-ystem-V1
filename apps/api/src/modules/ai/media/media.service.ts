import { Injectable, NotFoundException } from "@nestjs/common";
import { MediaAssetModel } from "../models/media-asset.schema.js";

@Injectable()
export class MediaService {
  async getMedia(mediaId: string) {
    const media = await MediaAssetModel.findOne({ mediaId }).lean();
    if (!media) {
      throw new NotFoundException({
        code: "MEDIA_NOT_FOUND",
        message: "Media asset was not found.",
      });
    }
    return {
      mediaId: media.mediaId,
      status: media.status,
      kind: media.kind,
      originalFilename: media.originalFilename,
      sanitizedFilename: media.sanitizedFilename,
      verifiedMime: media.verifiedMime ?? null,
      originalBytes: media.originalBytes ?? null,
      width: media.width ?? null,
      height: media.height ?? null,
      pageCount: media.pageCount ?? null,
      sha256: media.sha256 ?? null,
      duplicateStatus: media.duplicateStatus,
      exactDuplicateOfMediaId: media.exactDuplicateOfMediaId ?? null,
      originalObjectKey: media.originalObjectKey ?? null,
      normalizedObjectKey: media.normalizedObjectKey ?? null,
      readyAt: media.readyAt?.toISOString() ?? null,
      createdAt: media.createdAt?.toISOString() ?? null,
      updatedAt: media.updatedAt?.toISOString() ?? null,
    };
  }
}
