
import { Module } from "@nestjs/common";
import { HealthController } from "./modules/health.controller";
import { AuthController } from "./modules/auth.controller";
import { ResourcesController } from "./modules/resources.controller";
import { PublicController } from "./modules/public.controller";

@Module({
  controllers: [HealthController, AuthController, ResourcesController, PublicController],
})
export class AppModule {}
