import type { Template } from "../types";

const solarTemplate: Template = {
  name: "solar-instruct",
  content: `{{#each Messages}}
{{#if (eq role "system")}}### System:
{{else if (eq role "user")}}### User:
{{else if (eq role "assistant")}}### Assistant:
{{/if}}
{{content}}</s>

{{/each}}### Assistant:
`,
  stop: ["### System:", "### User:", "### Assistant"],
  protocol: "none",
};

export default solarTemplate;
