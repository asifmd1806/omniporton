import Handlebars from "handlebars";
import type { ChatMessage } from "../chat/types";
import { promises as fs } from "fs";
import type { Template } from './types';

interface CompiledTemplate {
  template: Handlebars.TemplateDelegate;
  stop: string[];
}

export class TemplateRegistry {
  private templateRegistry = new Map<string, CompiledTemplate>();
  private templateConfigRegistry = new Map<string, Template>();

  constructor() {
    this.registerHandlebarsHelpers();
  }

  private registerHandlebarsHelpers(): void {
    Handlebars.registerHelper("eq", (a, b) => a === b);
    Handlebars.registerHelper("setRoot", function (key, value, options) {
      // @ts-ignore
      this.root = this.root || {};
      // @ts-ignore
      this.root[key] = value;
    });
    Handlebars.registerHelper("concat", (a, b) => `${a}${b}`);
    Handlebars.registerHelper("or", function (...args) {
      return args.slice(0, -1).some(Boolean);
    });
  }

  registerTemplate(modelId: string, template: Template): void {
    const compiled = Handlebars.compile(template.content);
    this.templateRegistry.set(modelId, {
      template: compiled,
      stop: template.stop || [],
    });
    this.templateConfigRegistry.set(modelId, template);
  }

  async loadTemplateFromFile(
    modelId: string,
    tmplPath: string,
    stopPath?: string,
  ): Promise<void> {
    const content = await fs.readFile(tmplPath, "utf8");
    let stop: string[] | undefined = undefined;
    if (stopPath) {
      const stopJson = await fs.readFile(stopPath, "utf8");
      try {
        const parsed = JSON.parse(stopJson);
        if (Array.isArray(parsed.stop)) stop = parsed.stop;
        else if (Array.isArray(parsed)) stop = parsed;
      } catch (e) {
        throw new Error(`Failed to parse stopword list at ${stopPath}: ${e}`);
      }
    }
    this.registerTemplate(modelId, { name: modelId, content, stop });
  }

  listTemplates(): string[] {
    return Array.from(this.templateRegistry.keys());
  }

  removeTemplate(modelId: string): void {
    this.templateRegistry.delete(modelId);
    this.templateConfigRegistry.delete(modelId);
  }

  hasTemplate(modelId: string): boolean {
    return this.templateRegistry.has(modelId);
  }

  getTemplateStopwords(modelId: string): string[] {
    const entry = this.templateRegistry.get(modelId);
    if (!entry) throw new Error(`No template registered for model '${modelId}'`);
    return entry.stop;
  }

  formatPrompt(modelId: string, messages: ChatMessage[]): string {
    const config = this.templateConfigRegistry.get(modelId);
    const entry = this.templateRegistry.get(modelId);
    if (!entry)
      throw new Error(`No template registered for model '${modelId}'`);
    let context: any = { Messages: messages };
    if (config && typeof config.preprocess === 'function') {
      context = config.preprocess(messages);
    }
    return entry.template(context);
  }

  getTemplateConfig(modelId: string): Template | undefined {
    return this.templateConfigRegistry.get(modelId);
  }

  get(modelId: string): Template | undefined {
    return this.getTemplateConfig(modelId);
  }
}