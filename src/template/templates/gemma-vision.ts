import type { Template } from "../types";
import { extractText, extractMedia } from "../../utils/media";
import type { MessageContent } from "../../chat/types";

const gemmaVisionTemplate: Template = {
  name: "gemma-vision",
  content: `<start_of_turn>user
{{#each Messages}}{{#if (eq role "user")}}{{content}}{{/if}}{{/each}}
<end_of_turn>
<start_of_turn>model
`,
  stop: ["<end_of_turn>"],
  protocol: "none",
  capabilities: {
    supportsText: true,
    supportsImages: true,
    supportsAudio: false,
    supportsVideo: false,
    supportsDocuments: false,
    maxImageCount: 5
  },
  multiModalPreprocess: (content: MessageContent): string => {
    const text = extractText(content);
    const media = extractMedia(content);
    
    // PaliGemma/Gemma Vision expects images to be embedded inline
    if (media.length > 0) {
      const imageRefs = media
        .filter(m => m.type === 'image')
        .map(m => `<image${m.url ? ` src="${m.url}"` : ''}/>`)
        .join('');
      
      return `${imageRefs}${text}`;
    }
    
    return text;
  }
};

export default gemmaVisionTemplate;