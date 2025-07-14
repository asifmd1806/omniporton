import type { Template } from "../types";

const gemma3Template: Template = {
  name: "gemma3-instruct",
  content: `{{#each Messages}}
{{#if (eq role "user")}}<start_of_turn>user
{{content}}<end_of_turn>
{{else if (eq role "assistant")}}<start_of_turn>model
{{content}}<end_of_turn>
{{/if}}
{{/each}}<start_of_turn>model
`,
  stop: ["<end_of_turn>"],
  protocol: "none",
};

export default gemma3Template;
