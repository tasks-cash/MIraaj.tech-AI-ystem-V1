import { Module } from "@nestjs/common";
import { CreativeQueueService } from "./creative-queue.service.js";

@Module({
  providers: [CreativeQueueService],
  exports: [CreativeQueueService],
})
export class CreativeQueueModule {}
