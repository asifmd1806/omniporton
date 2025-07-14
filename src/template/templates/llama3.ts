import type { Template } from "../types";

const llama3Template: Template = {
  name: "llama3-instruct",
  content: `{{#each Messages}}<|start_header_id|>{{role}}<|end_header_id|>

{{content}}<|eot_id|>
{{/each}}<|start_header_id|>assistant<|end_header_id|>
`,
  stop: ["<|start_header_id|>", "<|end_header_id|>", "<|eot_id|>"],
  protocol: "none",
};

export default llama3Template;
