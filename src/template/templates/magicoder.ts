import type { Template } from "../types";

const magicoderTemplate: Template = {
  name: "magicoder",
  content: `{{#each Messages}}
{{#if (eq role "system")}}{{content}}\n\n{{/if}}{{#if (eq role "user")}}@@ Instruction\n{{content}}\n\n{{/if}}{{#if (eq role "assistant")}}@@ Response\n{{content}}\n\n{{/if}}
{{/each}}@@ Response\n`,
  stop: ["@@ Instruction", "@@ Response"],
  protocol: "none",
};

export default magicoderTemplate;
 