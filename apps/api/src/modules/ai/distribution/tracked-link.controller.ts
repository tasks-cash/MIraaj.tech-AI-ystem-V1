/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Controller, Get, Inject, Param, Redirect } from "@nestjs/common";
import { DistributionService } from "./distribution.service.js";

@Controller("r")
export class TrackedLinkController {
  constructor(@Inject(DistributionService) private readonly service: DistributionService) {}

  @Get(":opaqueToken")
  @Redirect(undefined, 302)
  async redirect(@Param("opaqueToken") opaqueToken: string) {
    return { url: await this.service.resolveTrackedLink(opaqueToken), statusCode: 302 };
  }
}
