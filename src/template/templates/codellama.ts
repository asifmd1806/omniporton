import type { Template } from "../types";

const codellamaTemplate: Template = {
  name: "codellama",
  content: `{{#each Messages}}Source:
{{#if (eq role "system")}} system{{else if (eq role "user")}} user{{else if (eq role "assistant")}} assistant{{/if}}

 {{content}} <step> {{/each}}Source: assistant
Destination: user
`,
  stop: ["Source:", "Destination:", "<step>"],
  protocol: "none",
};

export default codellamaTemplate;
 