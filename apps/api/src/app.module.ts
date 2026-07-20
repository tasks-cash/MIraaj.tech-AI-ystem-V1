import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { InfrastructureModule } from "./infrastructure.module.js";
import { AiModule } from "./modules/ai/ai.module.js";

@Module({
  imports: [InfrastructureModule, AiModule],
  controllers: [HealthController],
})
export class AppModule {}
