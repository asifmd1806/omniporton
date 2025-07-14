# Omniporton

A TypeScript library for building AI applications with local models, multi-modal support, and session management optimized for frontend applications.

## 📚 Documentation

**[View Full Documentation](https://omniporton.mintlify.app/)**

## Provider Categories

### Local Providers
- **node-llama-cpp**: Privacy-focused local inference with GGUF models
- **ollama**: Local model management and inference

### Cloud Providers
- **openai**: OpenAI GPT models with vision and audio support
- **claude**: Anthropic Claude models with advanced reasoning
- **gemini**: Google Gemini models with multimodal capabilities
- **mistral**: Mistral AI models with European focus
- **groq**: Ultra-fast inference with open-source models

## Installation

```bash
npm install omniporton
```

## Quick Start

```typescript
import { createChatSession, Utils } from 'omniporton';

// Create chat session with cloud provider
const session = createChatSession({
  sessionId: 'cloud-session',
  provider: 'openai',
  providerConfig: {
    apiKey: 'your-openai-api-key',
    model: 'gpt-4o-mini'
  }
});

// Text conversation
const response = await session.chat("What are the benefits of renewable energy?");

// Multi-modal conversation
const analysis = await session.sendMultiModal(
  Utils.createMultiModalContent(
    "Analyze this medical X-ray for abnormalities",
    Utils.createImageFromUrl("https://hospital.com/xray-001.jpg")
  )
);

// Local provider example
const localSession = createChatSession({
  sessionId: 'local-session',
  provider: 'node-llama-cpp',
  providerConfig: {
    modelPath: './models/llama3-8b-instruct.gguf'
  }
});
```

## Core Features

### Session Management

Complete session lifecycle management with message history, state persistence, and frontend integration:

```typescript
import { createChatSession } from 'omniporton';

// Create session with local provider
const session = createChatSession({
  sessionId: 'my-session',
  provider: 'node-llama-cpp',
  providerConfig: {
    modelPath: './models/llama3-8b-instruct.gguf'
  }
});

// Send messages
await session.chat("Hello! I need help with my React project.");
await session.chat("How do I manage state in a large application?");

// Get conversation history
const messages = session.getHistory();
console.log(`Session has ${messages.length} messages`);

// Message structure
messages.forEach(msg => {
  console.log(`[${msg.role}]: ${msg.content}`);
});

// Stream responses
await session.astream_chat("Explain machine learning", {}, (data) => {
  if (data.type === 'content') {
    console.log(data.text);
  }
});
```

### Message Handling

Rich message structure with multi-modal content support:

```typescript
// Text messages
const textResponse = await session.chat("How do I optimize database queries?");

// Multi-modal messages
const imageAnalysis = await session.sendMultiModal(
  createMultiModalContent(
    "Review this database schema design",
    createImageFromUrl("https://db-design.com/schema.png")
  )
);

// Message filtering and search
const history = session.getHistory();
const userMessages = history.filter(msg => msg.role === 'user');
const reactMessages = history.filter(msg => 
  extractText(msg.content).toLowerCase().includes('react')
);

// Session analytics
const analytics = {
  totalMessages: history.length,
  userMessages: userMessages.length,
  multiModalMessages: history.filter(msg => isMultiModal(msg.content)).length
};
```

### Model Management

Register and manage models with capability declarations:

```typescript
import { createChatSession } from 'omniporton';

// Text-only model session
const textSession = createChatSession({
  sessionId: 'text-session',
  provider: 'node-llama-cpp',
  providerConfig: {
    modelPath: './models/llama3-8b-instruct.gguf'
  }
});

// Vision model session
const visionSession = createChatSession({
  sessionId: 'vision-session',
  provider: 'node-llama-cpp',
  providerConfig: {
    modelPath: './models/llava-1.5-13b.gguf'
  }
});
```

### Multi-Modal Content

Process images, documents, audio, and video alongside text:

```typescript
import { 
  createImageFromUrl, 
  createDocumentFromData, 
  createMultiModalContent 
} from 'omniporton';

// Image analysis
const imageContent = createMultiModalContent(
  "What medical condition does this X-ray show?",
  createImageFromUrl("https://hospital.com/patient-xray.jpg")
);

// Document processing
const docContent = createMultiModalContent(
  "Summarize this quarterly report",
  createDocumentFromData(reportPdf, "application/pdf", "q3-report.pdf")
);

// Send multi-modal content
const imageAnalysis = await session.sendMultiModal(imageContent);
const docSummary = await session.sendMultiModal(docContent);
```

## Provider-Specific Examples

### OpenAI Integration

```typescript
import { createChatSession } from 'omniporton';

// GPT-4 for complex reasoning
const gpt4Session = createChatSession({
  sessionId: 'gpt4-session',
  provider: 'openai',
  providerConfig: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4-turbo'
  }
});
const analysis = await gpt4Session.chat("Analyze this business strategy");

// GPT-4 Vision for image analysis
const visionSession = createChatSession({
  sessionId: 'vision-session',
  provider: 'openai',
  providerConfig: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4-vision-preview'
  }
});
const imageAnalysis = await visionSession.sendMultiModal(
  createMultiModalContent(
    "Analyze this chart for trends",
    createImageFromUrl("https://company.com/sales-chart.png")
  )
);
```

### Claude Integration

```typescript
import { createChatSession } from 'omniporton';

// Claude-3 Opus for complex analysis
const opusSession = createChatSession({
  sessionId: 'opus-session',
  provider: 'claude',
  providerConfig: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-3-opus-20240229'
  }
});
const legalAnalysis = await opusSession.sendMultiModal(
  createMultiModalContent(
    "Review this contract for risks",
    createDocumentFromData(contractPdf, "application/pdf", "contract.pdf")
  )
);

// Claude-3 Haiku for fast responses
const haikuSession = createChatSession({
  sessionId: 'haiku-session',
  provider: 'claude',
  providerConfig: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-3-haiku-20240307'
  }
});
const quickResponse = await haikuSession.chat("Summarize this in 3 points");
```

### Local LLaMA Models

```typescript
import { createChatSession } from 'omniporton';

// LLaMA-3 8B for general chat (Local Provider)
const generalSession = createChatSession({
  sessionId: 'general-session',
  provider: 'node-llama-cpp',
  providerConfig: {
    modelPath: './models/llama3-8b-instruct.gguf'
  }
});
const response = await generalSession.chat("Help me debug this React component");

// Code Llama for programming tasks (Local Provider)
const codeSession = createChatSession({
  sessionId: 'code-session',
  provider: 'node-llama-cpp',
  providerConfig: {
    modelPath: './models/codellama-13b-instruct.gguf'
  }
});
const codeReview = await codeSession.chat(`
  Review this Python function:
  def process_data(data):
      return [x * 2 for x in data if x > 0]
`);

// LLaVA for vision tasks (Local Provider)
const visionSession = createChatSession({
  sessionId: 'vision-session',
  provider: 'node-llama-cpp',
  providerConfig: {
    modelPath: './models/llava-1.5-13b.gguf'
  }
});
const uiAnalysis = await visionSession.sendMultiModal(
  createMultiModalContent(
    "Suggest improvements for this UI",
    createImageFromUrl("https://app.com/ui-screenshot.png")
  )
);
```

## Frontend Integration

### React Hook Pattern

```typescript
import { useState, useCallback } from 'react';
import { createChatSession, extractText } from 'omniporton';

function useChatSession(provider: string, config: any) {
  const [session] = useState(() => createChatSession({
    sessionId: 'react-session',
    provider,
    providerConfig: config
  }));
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const sendMessage = useCallback(async (content: string) => {
    const response = await session.chat(content);
    setMessages(session.getHistory());
    return response;
  }, [session]);
  
  const streamMessage = useCallback(async (content: string, onChunk: (text: string) => void) => {
    setIsStreaming(true);
    await session.astream_chat(content, {}, (data) => {
      if (data.type === 'content') {
        onChunk(data.text);
      }
    });
    setIsStreaming(false);
    setMessages(session.getHistory());
  }, [session]);
  
  return {
    messages,
    isStreaming,
    sendMessage,
    streamMessage,
    getLastText: () => session.getLastTextContent()
  };
}

// Usage in component
function ChatComponent() {
  const { messages, isStreaming, sendMessage, streamMessage } = useChatSession('node-llama-cpp', {
    modelPath: './models/llama3-8b-instruct.gguf'
  });
  const [input, setInput] = useState('');
  
  const handleSend = async () => {
    if (input.trim()) {
      await sendMessage(input);
      setInput('');
    }
  };
  
  return (
    <div>
      <div className="messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            {extractText(msg.content)}
          </div>
        ))}
      </div>
      <input 
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        disabled={isStreaming}
      />
      <button onClick={handleSend} disabled={isStreaming}>
        {isStreaming ? 'Sending...' : 'Send'}
      </button>
    </div>
  );
}
```

### Session Persistence

```typescript
import { createChatSession } from 'omniporton';

class PersistentSessionManager {
  saveSession(sessionId: string) {
    const sessionData = this.exportSession(sessionId);
    localStorage.setItem(`chat_session_${sessionId}`, JSON.stringify(sessionData));
  }
  
  loadSession(sessionId: string) {
    const data = localStorage.getItem(`chat_session_${sessionId}`);
    if (data) {
      return this.importSession(sessionId, JSON.parse(data));
    }
    return null;
  }
  
  listSavedSessions() {
    const sessions = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('chat_session_')) {
        const sessionId = key.replace('chat_session_', '');
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        sessions.push({
          id: sessionId,
          created: data.metadata?.created,
          messageCount: data.messages?.length || 0
        });
      }
    }
    return sessions;
  }
}
```

## Advanced Usage

### Batch Processing

```typescript
// Process multiple documents
const documents = [
  { name: 'report1.pdf', content: pdf1Base64 },
  { name: 'report2.pdf', content: pdf2Base64 },
  { name: 'report3.pdf', content: pdf3Base64 }
];

const session = createChatSession({
  sessionId: 'batch-session',
  provider: 'claude',
  providerConfig: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-3-sonnet-20240229'
  }
});
const summaries = [];

for (const doc of documents) {
  const summary = await session.sendMultiModal(
    createMultiModalContent(
      `Summarize this ${doc.name} in 3 key points`,
      createDocumentFromData(doc.content, 'application/pdf', doc.name)
    )
  );
  summaries.push({ document: doc.name, summary });
}
```

### Error Handling

```typescript
const safeChat = async (session: any, message: string) => {
  try {
    return await session.chat(message);
  } catch (error) {
    if (error.message.includes('context length')) {
      console.warn('Context limit reached, starting new session');
      // Handle context overflow
    } else if (error.message.includes('model not found')) {
      console.error('Model not available');
      // Handle model errors
    } else {
      console.error('Unexpected error:', error);
      // Handle other errors
    }
    throw error;
  }
};
```

### Performance Optimization

```typescript
// Configure session for optimal performance
const optimizedSession = createChatSession({
  sessionId: 'optimized-session',
  provider: 'node-llama-cpp',
  providerConfig: {
    modelPath: './models/llama3-8b-instruct.gguf',
    contextSize: 4096,
    batchSize: 512,
    threads: 8,
    temperature: 0.7
  }
});

// Use appropriate provider and model for task
const selectProvider = (taskType: string) => {
  if (taskType === 'code') return { provider: 'node-llama-cpp', model: 'codellama-13b' };
  if (taskType === 'vision') return { provider: 'openai', model: 'gpt-4o-mini' };
  if (taskType === 'reasoning') return { provider: 'claude', model: 'claude-3-opus-20240229' };
  return { provider: 'node-llama-cpp', model: 'llama3-8b' };
};
```

## Built-in Templates

### Text Models
- `llama2`, `llama3` - Meta's LLaMA models
- `mistral` - Mistral AI models
- `codellama` - Code generation
- `gemma` - Google Gemma models

### Vision Models
- `llava` - Image understanding
- `qwen-vl` - Multi-modal reasoning
- `gemma-vision` - Google's vision model

### Template Usage
```typescript
import { createChatSession } from 'omniporton';

// Create session with custom system prompt
const customerServiceSession = createChatSession({
  sessionId: 'customer-service',
  provider: 'openai',
  providerConfig: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
    systemPrompt: 'You are a helpful customer service representative.'
  }
});
```

## ✨ Key Features

- **🔒 Privacy-First**: Local inference with node-llama-cpp and Ollama
- **🌐 Multi-Provider**: Support for OpenAI, Claude, Gemini, Mistral, Groq
- **📱 Multi-Modal**: Text, images, documents, audio, and video support
- **💾 Session Management**: Complete conversation tracking and persistence
- **⚡ Streaming**: Real-time response delivery
- **🎯 Frontend Optimized**: Built for React, Vue, and modern web apps
- **🔧 Developer Experience**: TypeScript support with comprehensive examples

## 📖 Quick Links

- [**Getting Started**](https://omniporton.mintlify.app/quickstart) - Installation and setup
- [**Providers Guide**](https://omniporton.mintlify.app/providers/overview) - All supported AI providers
- [**Examples**](https://omniporton.mintlify.app/examples) - Real-world usage examples
- [**API Reference**](https://omniporton.mintlify.app/core/sessions) - Complete API documentation

## License

MIT