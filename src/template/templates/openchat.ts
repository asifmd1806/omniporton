import type { Template } from "../types";

const openchatTemplate: Template = {
  name: "openchat",
  content: `{{#each Messages}}GPT4 Correct
{{#if (eq role "system")}} System:{{else if (eq role "user")}} User:{{else if (eq role "assistant")}} Assistant:{{/if}} {{content}}<|end_of_turn|>
{{/each}}GPT4 Correct Assistant:
`,
  stop: ["<|end_of_turn|>"],
  protocol: "none",
};

export default openchatTemplate;
