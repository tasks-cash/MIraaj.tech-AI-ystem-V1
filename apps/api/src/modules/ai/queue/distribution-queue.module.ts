import { Module } from "@nestjs/common";
import { DistributionQueueService } from "./distribution-queue.service.js";

@Module({ providers: [DistributionQueueService], exports: [DistributionQueueService] })
export class DistributionQueueModule {}
