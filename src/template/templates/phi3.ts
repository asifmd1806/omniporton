import type { Template } from "../types";

const phi3Template: Template = {
  name: "phi-3",
  content: `{{#each Messages}}
{{#if (eq role "system")}}<|system|>\n{{content}}\n<|end|>\n{{else if (eq role "user")}}<|user|>\n{{content}}\n<|end|>\n{{else if (eq role "assistant")}}<|assistant|>\n{{content}}\n<|end|>\n{{/if}}
{{/each}}<|assistant|>\n`,
  stop: ["<|system|>", "<|user|>", "<|assistant|>", "<|end|>"],
  protocol: "none",
};

export default phi3Template;
