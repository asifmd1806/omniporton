import type { Template } from "../types";
import { extractText, extractMedia } from "../../utils/media";
import type { MessageContent } from "../../chat/types";

const llavaTemplate: Template = {
  name: "llava",
  content: `{{#each Messages}}<|start_header_id|>{{role}}<|end_header_id|>

{{content}}<|eot_id|>
{{/each}}<|start_header_id|>assistant<|end_header_id|>
`,
  stop: ["<|start_header_id|>", "<|end_header_id|>", "<|eot_id|>"],
  protocol: "none",
  capabilities: {
    supportsText: true,
    supportsImages: true,
    supportsAudio: false,
    supportsVideo: false,
    supportsDocuments: false,
    maxImageCount: 1
  },
  multiModalPreprocess: (content: MessageContent): string => {
    const text = extractText(content);
    const media = extractMedia(content);
    
    // LLaVA expects images to be referenced in a specific format
    if (media.length > 0) {
      const imageRefs = media
        .filter(m => m.type === 'image')
        .map(m => m.url ? `[IMAGE: ${m.url}]` : '[IMAGE]')
        .join(' ');
      
      return `${imageRefs} ${text}`.trim();
    }
    
    return text;
  }
};

export default llavaTemplate;