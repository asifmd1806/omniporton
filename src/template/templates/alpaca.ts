import type { Template } from "../types";

const alpacaTemplate: Template = {
  name: "alpaca",
  content: `{{#each Messages}}
{{#if (eq role "system")}}{{content}}\n\n{{else if (eq role "user")}}### Instruction:\n{{content}}\n\n{{else if (eq role "assistant")}}### Response:\n{{content}}\n\n{{/if}}
{{/each}}### Response:\n`,
  stop: ["### Instruction:", "### Response"],
  protocol: "none",
};

export default alpacaTemplate;
