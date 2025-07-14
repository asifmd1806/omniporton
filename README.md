# Omniporton

A TypeScript library for building AI applications with local models, multi-modal support, and session management optimized for frontend applications.

## 📚 Documentation

**[View Full Documentation](https://omniporton.mintlify.app/)**

## Installation

```bash
npm install omniporton
```

## Quick Start

```typescript
import { createChatSession } from 'omniporton';

// Cloud provider example
const session = createChatSession({
  sessionId: 'my-session',
  provider: 'openai',
  providerConfig: {
    apiKey: 'your-openai-api-key',
    model: 'gpt-4o-mini'
  }
});

const response = await session.chat("Hello, world!");
console.log(response);

// Local provider example
const localSession = createChatSession({
  sessionId: 'local-session',
  provider: 'node-llama-cpp',
  providerConfig: {
    modelPath: './models/llama3-8b-instruct.gguf'
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

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Issue Templates

- [🐛 Bug Report](https://github.com/asifmd1806/omniporton/issues/new?template=bug_report.md)
- [✨ Feature Request](https://github.com/asifmd1806/omniporton/issues/new?template=feature_request.md)
- [📝 Documentation](https://github.com/asifmd1806/omniporton/issues/new?template=documentation.md)

### Pull Request Template

Please use our [Pull Request Template](https://github.com/asifmd1806/omniporton/blob/main/.github/pull_request_template.md) when submitting PRs.

## 📄 License

MIT