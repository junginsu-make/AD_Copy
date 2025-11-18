import { db } from "@/src/infrastructure/database";
import {
  modelUsageLogs,
  type NewModelUsageLog,
} from "@/src/infrastructure/database/schema";

export class ModelUsageLogger {
  async log(entry: NewModelUsageLog) {
    await db.insert(modelUsageLogs).values(entry);
  }
}

