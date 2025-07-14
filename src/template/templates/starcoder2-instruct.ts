import type { Template } from "../types";

const starcoder2InstructTemplate: Template = {
  name: "starcoder2-instruct",
  content: `{{#*inline "sysblock"}}
{{system}}
{{/inline}}
{{#each Messages}}
{{#if (eq role "system")}}{{#unless @root.system}}{{setRoot "system" content}}{{else}}{{setRoot "system" (concat @root.system "\n\n" content)}}{{/unless}}
{{else if (eq role "user")}}{{#if @root.system}}{{> sysblock}}{{setRoot "system" ""}}{{/if}}### Instruction
{{content}}

{{else if (eq role "assistant")}}### Response
{{content}}<|endoftext|>

{{/if}}
{{/each}}### Response
`,
  stop: ["### Instruction", "### Response", "<|endoftext|>"],
  protocol: "none",
};

export default starcoder2InstructTemplate;
 