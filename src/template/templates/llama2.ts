import type { Template, ChatMessage } from "../types";

const llama2Template: Template = {
  name: "llama2-chat",
  content: `[INST]{{#each Messages}}
{{#if (eq role "user")}}
{{content}} [/INST]
{{else if (eq role "assistant")}} {{content}}</s>[INST] {{/if}}
{{/each}}`,
  stop: ["[INST]", "[/INST]", "<<SYS>>", "<</SYS>>"],
  protocol: "none",
  preprocess(messages: ChatMessage[]) {
    const sys = messages.filter(m => m.role === "system").map(m => m.content).join("\n\n");
    let rest: ChatMessage[] = [];
    let sysInjected = false;
    for (const m of messages) {
      if (m.role === "user" && sys && !sysInjected) {
        rest.push({
          role: "user",
          content: `<<SYS>>\n${sys}\n<</SYS>>\n\n${m.content}`,
        });
        sysInjected = true;
      } else if (m.role !== "system") {
        rest.push(m);
      }
    }
    return { Messages: rest };
  }
};

export default llama2Template;
 