
import { MaraajClient, type MaraajClientOptions } from "./index";

/** Typed helper surface for Tasks.cash integrations. */
export class TasksCashClient extends MaraajClient {
  constructor(opts: MaraajClientOptions) {
    super(opts);
  }

  async createTaskPost(input: {
    taskId: string;
    title: string;
    locale?: string;
    candidateCategories?: string[];
    assetId?: string;
    destinationUrl?: string;
  }) {
    return this.posts.create(
      {
        source: "tasks-cash",
        sourceReference: input.taskId,
        title: input.title,
        locale: input.locale ?? "ar-DZ",
        candidateCategories: input.candidateCategories ?? [
          "entertainment",
          "artificial-intelligence",
          "dentistry",
        ],
        assetId: input.assetId,
        destinationUrl: input.destinationUrl,
      },
      { idempotencyKey: input.taskId },
    );
  }
}

export { MaraajClient };
