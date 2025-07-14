# Omniporton Core Architecture

## Overview

Omniporton is a modular TypeScript library designed for building AI chat applications with multiple providers. The architecture follows a layered approach with clear separation of concerns.

## Core Components

### 1. Agent Layer
- **Purpose**: Top-level orchestration component
- **Responsibilities**: 
  - Manages high-level conversation flow
  - Coordinates between different components
  - Provides a unified interface for AI interactions

### 2. ChatSession Layer
- **Purpose**: Manages conversation state and context
- **Responsibilities**:
  - Maintains message history
  - Handles conversation persistence
  - Manages session configuration
  - Provides streaming capabilities

### 3. LLMProvider Layer
- **Purpose**: Handles communication with different AI providers
- **Responsibilities**:
  - Abstracts provider-specific implementations
  - Manages API calls and responses
  - Handles authentication and configuration
  - Supports both local and cloud providers

### 4. Supporting Components

#### MessageExtractor
- Processes and extracts information from messages
- Handles different message formats and types
- Supports multi-modal content extraction

#### Template System
- Manages prompt templating for different models
- Provides pre-built templates for common use cases
- Supports custom template creation

#### Tools Integration
- Provides extensible tool integration framework
- Supports function calling and tool execution
- Manages tool discovery and registration

#### MCP Services
- Implements Model Context Protocol integrations
- Handles external service connections
- Manages resource sharing between components

## Architecture Flow

```
User Input → Agent → ChatSession → LLMProvider → AI Provider
    ↓           ↓         ↓           ↓
  Tools ← MessageExtractor ← Template ← MCP Services
```

## Provider Architecture

### Local Providers
- **node-llama-cpp**: Direct integration with local GGUF models
- **ollama**: Integration with Ollama model management system

### Cloud Providers
- **OpenAI**: GPT models with vision and audio support
- **Anthropic**: Claude models with advanced reasoning
- **Google**: Gemini models with multimodal capabilities
- **Mistral**: European-focused AI models
- **Groq**: Ultra-fast inference with open-source models

## Key Design Principles

1. **Modularity**: Each component has a specific responsibility
2. **Extensibility**: Easy to add new providers and tools
3. **Type Safety**: Full TypeScript support throughout
4. **Unified API**: Single interface for all providers
5. **Performance**: Optimized for real-world applications
6. **Privacy**: Support for local inference options

## Session Management

The session management system provides:
- Persistent conversation state
- Message history tracking
- Multi-modal content support
- Streaming response handling
- Error recovery and retry logic

## Multi-Modal Support

Omniporton supports various content types:
- Text messages
- Image processing
- Document analysis
- Audio input/output
- Video content analysis

## Configuration System

The library uses a flexible configuration system:
- Provider-specific settings
- Global configuration options
- Environment variable support
- Runtime configuration updates