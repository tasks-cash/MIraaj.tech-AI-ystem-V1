import { Module } from "@nestjs/common";
import { CampaignQueueService } from "./campaign-queue.service.js";

@Module({
  providers: [CampaignQueueService],
  exports: [CampaignQueueService],
})
export class CampaignQueueModule {}
