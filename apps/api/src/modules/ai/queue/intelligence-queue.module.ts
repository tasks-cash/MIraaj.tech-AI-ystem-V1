import { Module } from "@nestjs/common";
import { IntelligenceQueueService } from "./intelligence-queue.service.js";

@Module({
  providers: [IntelligenceQueueService],
  exports: [IntelligenceQueueService],
})
export class IntelligenceQueueModule {}
