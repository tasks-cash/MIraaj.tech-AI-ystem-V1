import type { Model, UpdateQuery } from "mongoose";

export async function transitionStatus<T extends { status: string }>(
  model: Model<T>,
  filter: Record<string, unknown>,
  fromStatus: string,
  update: UpdateQuery<T>,
): Promise<T | null> {
  return model.findOneAndUpdate(
    { ...filter, status: fromStatus },
    update,
    { new: true },
  );
}

export async function transitionJobStatus<T extends { status: string }>(
  model: Model<T>,
  jobId: string,
  fromStatus: string,
  update: UpdateQuery<T>,
): Promise<T | null> {
  return transitionStatus(model, { jobId }, fromStatus, update);
}
