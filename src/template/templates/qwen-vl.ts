import type { Template } from "../types";
import { extractText, extractMedia } from "../../utils/media";
import type { MessageContent } from "../../chat/types";

const qwenVLTemplate: Template = {
  name: "qwen-vl",
  content: `<|im_start|>system
You are a helpful assistant.<|im_end|>
{{#each Messages}}<|im_start|>{{role}}
{{content}}<|im_end|>
{{/each}}<|im_start|>assistant
`,
  stop: ["<|im_end|>", "<|im_start|>"],
  protocol: "none",
  capabilities: {
    supportsText: true,
    supportsImages: true,
    supportsAudio: false,
    supportsVideo: true,
    supportsDocuments: false,
    maxImageCount: 10,
    maxVideoCount: 1
  },
  multiModalPreprocess: (content: MessageContent): string => {
    const text = extractText(content);
    const media = extractMedia(content);
    
    if (media.length > 0) {
      const mediaRefs = media.map(m => {
        switch (m.type) {
          case 'image':
            return `<img>${m.url || '[IMAGE]'}</img>`;
          case 'video':
            return `<video>${m.url || '[VIDEO]'}</video>`;
          default:
            return '';
        }
      }).filter(Boolean).join('');
      
      return `${mediaRefs}${text}`;
    }
    
    return text;
  }
};

export default qwenVLTemplate;