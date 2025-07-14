import type { Template } from "../types";

const falconTemplate: Template = {
  name: "falcon",
  content: `{{#each Messages}}
{{#if (eq role "system")}}[System]\n{{content}}\n{{else if (eq role "user")}}[User]\n{{content}}\n{{else if (eq role "assistant")}}[Assistant]\n{{content}}\n{{/if}}
{{/each}}[Assistant]\n`,
  stop: ["[System]", "[User]", "[Assistant]"],
  protocol: "none",
};

export default falconTemplate;
