import { Module } from "@nestjs/common";
import { MediaQueueService } from "./media-queue.service.js";
import { MediaStorageService } from "../media/media-storage.service.js";

@Module({
  providers: [MediaStorageService, MediaQueueService],
  exports: [MediaQueueService, MediaStorageService],
})
export class MediaQueueModule {}
