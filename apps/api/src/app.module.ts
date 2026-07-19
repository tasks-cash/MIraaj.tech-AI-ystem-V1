import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { InfrastructureService } from "./infrastructure.service.js";
import { AiModule } from "./modules/ai/ai.module.js";

@Module({
  imports: [AiModule],
  controllers: [HealthController],
  providers: [InfrastructureService],
})
export class AppModule {}
