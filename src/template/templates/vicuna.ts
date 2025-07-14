import type { Template } from "../types";

const vicunaTemplate: Template = {
  name: "vicuna",
  content: `{{#each Messages}}
{{#if (eq role "system")}}SYSTEM: {{content}}\n{{else if (eq role "user")}}USER: {{content}}\n{{else if (eq role "assistant")}}ASSISTANT: {{content}}\n{{/if}}
{{/each}}ASSISTANT: `,
  stop: ["USER:", "ASSISTANT:", "SYSTEM:"],
};

export default vicunaTemplate;
