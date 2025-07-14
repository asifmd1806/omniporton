import type { ZodTypeAny } from "zod";

export type ToolDefinition = {
  name: string;
  description: string;
  schema: ZodTypeAny;
  handler: (args: any) => Promise<any> | any;
}; 