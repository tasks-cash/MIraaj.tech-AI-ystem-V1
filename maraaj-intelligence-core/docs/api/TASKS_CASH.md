
# Tasks.cash integration

```ts
import { TasksCashClient } from "@maraaj/api-client/tasks-cash";

const client = new TasksCashClient({
  baseUrl: process.env.MARAAJ_API_URL!,
  clientId: process.env.MARAAJ_CLIENT_ID!,
  keyId: process.env.MARAAJ_KEY_ID!,
  privateKey: process.env.MARAAJ_PRIVATE_KEY!,
  projectId: process.env.MARAAJ_PROJECT_ID!,
});

const post = await client.createTaskPost({
  taskId: "task_123",
  title: "Example",
  locale: "ar-DZ",
  destinationUrl: "https://example.com",
});
```
