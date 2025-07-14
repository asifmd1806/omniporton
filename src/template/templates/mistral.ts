import type { Template } from "../types";

const mistralTemplate: Template = {
  name: "mistral-instruct",
  content: `[INST] {{#each Messages}}
{{#if (eq role "system")}}{{content}}\n\n{{else if (eq role "user")}}{{content}}[/INST]
{{else if (eq role "assistant")}} {{content}}</s>[INST] {{/if}}
{{/each}}`,
  stop: ["<|im_start|>", "<|im_end|>"],
  protocol: "none",
};

export default mistralTemplate;
 