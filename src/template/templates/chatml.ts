import type { Template } from "../types";

const chatmlTemplate: Template = {
  name: "chatml",
  content: `{{#each Messages}}<|im_start|>{{role}}\n{{content}}<|im_end|>
{{/each}}<|im_start|>assistant\n`,
  stop: ["<|im_start|>", "<|im_end|>"],
};

export default chatmlTemplate;
