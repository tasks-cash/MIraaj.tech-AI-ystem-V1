
import mongoose from "mongoose";

declare global {
  // eslint-disable-next-line no-var
  var __maraajMongo: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } | undefined;
}

const cached = globalThis.__maraajMongo ?? { conn: null, promise: null };
globalThis.__maraajMongo = cached;

export async function connectMongo(uri: string): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 10_000,
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export async function disconnectMongo(): Promise<void> {
  if (cached.conn) {
    await mongoose.disconnect();
    cached.conn = null;
    cached.promise = null;
  }
}

export { mongoose };
