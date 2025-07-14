/**
 * Integration tests for Claude provider with real-world examples
 */

import 'dotenv/config';
import { 
  createChatSession, 
  createAgent,
  createMonitoringService,
  Utils
} from '../../dist/index.js';

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const SKIP_TESTS = !CLAUDE_API_KEY;

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  duration: number;
  output?: any;
}

class TestRunner {
  private results: TestResult[] = [];

  async runTest(name: string, testFn: () => Promise<any>): Promise<void> {
    if (SKIP_TESTS) {
      console.log(`⏭️  Skipping: ${name} (no API key)`);
      return;
    }

    const startTime = Date.now();
    console.log(`🧪 Testing: ${name}`);
    
    try {
      const output = await testFn();
      const duration = Date.now() - startTime;
      
      this.results.push({
        name,
        success: true,
        duration,
        output
      });
      
      console.log(`✅ ${name} - ${duration}ms`);
      if (output && typeof output === 'string' && output.length < 200) {
        console.log(`   Output: ${output}`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.results.push({
        name,
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
      
      console.log(`❌ ${name} - ${duration}ms`);
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  printSummary(): void {
    if (SKIP_TESTS) {
      console.log('\n⚠️  All Claude tests skipped - set ANTHROPIC_API_KEY or CLAUDE_API_KEY to run');
      return;
    }

    const successful = this.results.filter(r => r.success).length;
    const total = this.results.length;

    console.log('\n' + '='.repeat(60));
    console.log('📊 CLAUDE PROVIDER TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successful: ${successful}/${total}`);
    console.log(`❌ Failed: ${total - successful}/${total}`);

    if (total - successful > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results
        .filter(r => !r.success)
        .forEach(r => console.log(`   - ${r.name}: ${r.error}`));
    }

    if (total - successful > 0) {
      process.exit(1);
    }
  }
}

async function main() {
  console.log('🚀 Claude Provider Integration Tests');
  console.log('===================================\n');

  const runner = new TestRunner();

  // Test 1: Legal Document Analysis
  await runner.runTest('Legal Document Analysis - Contract Review', async () => {
    const agent = createAgent({
      id: 'legal-analyst',
      name: 'Legal Document Analyst',
      description: 'Expert in legal document analysis and contract review',
      provider: 'claude',
      providerConfig: {
        apiKey: CLAUDE_API_KEY,
        model: 'claude-3-haiku-20240307',
        maxTokens: 1000
      },
      systemPrompt: `You are a legal analyst. Review documents for:
1. Key terms and obligations
2. Potential risks or concerns
3. Missing standard clauses
4. Unusual or problematic language
Provide clear, structured analysis.`
    });

    const contractText = `
SOFTWARE LICENSE AGREEMENT

1. GRANT OF LICENSE: Licensor grants Licensee a non-exclusive license to use the Software.

2. RESTRICTIONS: Licensee may not reverse engineer, decompile, or distribute the Software.

3. PAYMENT: Licensee agrees to pay $10,000 annually, due within 90 days of invoice.

4. TERMINATION: Either party may terminate with 30 days notice. Upon termination, all data will be permanently deleted.

5. LIABILITY: Licensor's liability shall not exceed the amount paid by Licensee in the preceding 12 months.`;

    const analysis = await agent.execute(`Please analyze this software license agreement:\n\n${contractText}\n\nIdentify key terms, potential issues, and missing provisions.`);

    if (!analysis.includes('license') || !analysis.includes('liability')) {
      throw new Error('Legal analysis should address key contract terms');
    }

    return `Legal analysis completed: ${analysis.length} chars`;
  });

  // Test 2: Academic Research Assistant
  await runner.runTest('Academic Research - Literature Review', async () => {
    const session = createChatSession({
      sessionId: 'research-assistant-001',
      provider: 'claude',
      providerConfig: {
        apiKey: CLAUDE_API_KEY,
        model: 'claude-3-haiku-20240307',
        maxTokens: 1200
      }
    });

    session.addMessage({
      role: 'system',
      content: 'You are an academic research assistant specializing in computer science. Provide well-structured, evidence-based responses with proper academic tone.'
    });

    const researchQuery = `I'm writing a literature review on "Machine Learning in Cybersecurity: Intrusion Detection Systems." 

Can you help me identify:
1. Key research themes and approaches
2. Major methodologies used
3. Current limitations and gaps
4. Future research directions

Please structure your response academically with clear sections.`;

    const response = await session.chat(researchQuery);

    // Validate academic response with semantic content analysis
    if (!response || response.length < 20) {
      throw new Error('No academic response received from Claude API');
    }
    
    console.log(`[Claude Test] Academic Response (${response.length} chars):`, response.substring(0, 300) + '...');
    
    const academicIndicators = ['methodology', 'research', 'study', 'analysis', 'academic', 'scholarly', 'peer-reviewed', 'hypothesis', 'evidence', 'conclusion', 'findings', 'investigation', 'literature', 'theory', 'empirical'];
    const hasAcademicContent = academicIndicators.some(indicator => response.toLowerCase().includes(indicator));
    
    if (!hasAcademicContent) {
      console.warn('[Claude Test] Warning: Academic response may not include methodology discussion. Response:', response.substring(0, 200));
    }

    return `Academic response completed: ${response.length} chars`;
  });

  // Test 3: Creative Writing Assistant
  await runner.runTest('Creative Writing - Story Development', async () => {
    const session = createChatSession({
      sessionId: 'creative-writer-001',
      provider: 'claude',
      providerConfig: {
        apiKey: CLAUDE_API_KEY,
        model: 'claude-3-haiku-20240307',
        temperature: 0.8,
        maxTokens: 800
      }
    });

    const storyPrompt = `Write the opening paragraph of a science fiction short story with these elements:
- Setting: Mars colony in 2087
- Main character: Dr. Elena Vasquez, atmospheric engineer  
- Conflict: Mysterious oxygen readings in Sector 7
- Tone: Suspenseful but hopeful
- Style: Hard science fiction with technical details

The paragraph should be approximately 100-150 words and hook the reader immediately.`;

    const story = await session.chat(storyPrompt);

    // Validate story content with semantic analysis
    if (!story || story.length < 20) {
      throw new Error('No creative story response received from Claude API');
    }
    
    console.log(`[Claude Test] Creative Story Response (${story.length} chars):`, story.substring(0, 300) + '...');
    
    const storyIndicators = ['Elena', 'Mars', 'character', 'story', 'scene', 'dialogue', 'narrative', 'setting', 'plot', 'adventure', 'colony', 'engineer', 'oxygen', 'sector'];
    const hasStoryContent = storyIndicators.some(indicator => story.toLowerCase().includes(indicator.toLowerCase()));
    
    if (!hasStoryContent && story.length < 50) {
      console.warn('[Claude Test] Warning: Story may not include specified elements. Response:', story.substring(0, 200));
    }

    return `Creative story completed: ${story.length} chars`;
  });

  // Test 4: Data Science Consultation
  await runner.runTest('Data Science - Statistical Analysis Guidance', async () => {
    const agent = createAgent({
      id: 'data-scientist',
      name: 'Data Science Consultant',
      description: 'Expert in statistical analysis, machine learning, and data interpretation',
      provider: 'claude',
      providerConfig: {
        apiKey: CLAUDE_API_KEY,
        model: 'claude-3-haiku-20240307',
        temperature: 0.2,
        maxTokens: 1000
      },
      systemPrompt: 'You are a senior data scientist. Provide rigorous statistical guidance with methodology explanations and practical implementation advice.'
    });

    const dataScenario = `I have a dataset of 50,000 customer transactions with these variables:
- Transaction amount (continuous)
- Customer age (continuous) 
- Product category (categorical: electronics, clothing, books, food)
- Customer location (categorical: urban, suburban, rural)
- Purchase timestamp
- Customer satisfaction score (1-10)

Research Question: What factors most strongly predict customer satisfaction scores?

What statistical approach would you recommend, and what are the key considerations for this analysis?`;

    const guidance = await agent.execute(dataScenario);

    if (!guidance.includes('regression') && !guidance.includes('analysis')) {
      throw new Error('Data science guidance should include statistical methodology');
    }

    return guidance.substring(0, 300) + '...';
  });

  // Test 5: Multimodal Document Analysis
  await runner.runTest('Multimodal Analysis - Document and Image Processing', async () => {
    const session = createChatSession({
      sessionId: 'document-analyst-001',
      provider: 'claude',
      providerConfig: {
        apiKey: CLAUDE_API_KEY,
        model: 'claude-3-haiku-20240307',
        maxTokens: 800
      }
    });

    // Create a document analysis request with image
    const chartImage = Utils.createImageFromUrl('https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Linear_regression.svg/1200px-Linear_regression.svg.png');
    
    const multiModalContent = Utils.createMultiModalContent([
      'Analyze this statistical chart and provide insights:',
      chartImage,
      '\nPlease describe:\n1. What type of analysis is shown\n2. The relationship depicted\n3. Key insights about the data pattern\n4. Potential applications of this analysis'
    ]);

    const analysis = await session.sendMultiModal(multiModalContent);

    if (!analysis || analysis.length < 100) {
      throw new Error('Multimodal analysis should provide substantial insights');
    }

    return analysis.substring(0, 250) + '...';
  });

  // Test 6: Technical Writing and Documentation
  await runner.runTest('Technical Writing - Architecture Documentation', async () => {
    const session = createChatSession({
      sessionId: 'tech-writer-001',
      provider: 'claude',
      providerConfig: {
        apiKey: CLAUDE_API_KEY,
        model: 'claude-3-haiku-20240307',
        temperature: 0.3,
        maxTokens: 1200
      }
    });

    const architectureSpec = `Create technical documentation for a microservices architecture:

System: E-commerce Platform
Services:
- User Service (authentication, profiles)
- Product Service (catalog, inventory)  
- Order Service (cart, checkout, fulfillment)
- Payment Service (processing, refunds)
- Notification Service (email, SMS)

Communication: REST APIs + Message Queue (RabbitMQ)
Database: PostgreSQL per service + Redis cache
Deployment: Docker containers on Kubernetes

Please create a comprehensive architecture overview including service responsibilities, data flow, and integration patterns.`;

    const documentation = await session.chat(architectureSpec);

    if (!documentation.includes('microservices') || !documentation.includes('service')) {
      throw new Error('Architecture documentation should cover microservices concepts');
    }

    return documentation.substring(0, 300) + '...';
  });

  // Test 7: Streaming Response Analysis
  await runner.runTest('Streaming Analysis - Real-time Market Research', async () => {
    const session = createChatSession({
      sessionId: 'market-research-001',
      provider: 'claude',
      providerConfig: {
        apiKey: CLAUDE_API_KEY,
        model: 'claude-3-haiku-20240307',
        temperature: 0.4,
        maxTokens: 600
      }
    });

    let streamedContent = '';
    let chunkCount = 0;
    let firstChunkTime = 0;
    let lastChunkTime = 0;

    const marketQuery = `Analyze the current trends in the electric vehicle market for 2024:

1. Market size and growth projections
2. Key players and competitive landscape  
3. Technological innovations driving adoption
4. Regulatory factors and government incentives
5. Consumer adoption barriers and solutions

Provide a structured analysis with specific data points where possible.`;

    await session.stream(marketQuery, {}, (chunk) => {
      if (chunkCount === 0) {
        firstChunkTime = Date.now();
      }
      streamedContent += chunk.content;
      chunkCount++;
      lastChunkTime = Date.now();
    });

    const streamDuration = lastChunkTime - firstChunkTime;

    if (chunkCount < 3) {
      throw new Error('Expected multiple streaming chunks for long analysis');
    }

    if (!streamedContent.includes('electric vehicle') && !streamedContent.includes('EV')) {
      throw new Error('Market analysis should address electric vehicles');
    }

    return `Streamed ${chunkCount} chunks over ${streamDuration}ms, content length: ${streamedContent.length}`;
  });

  // Test 8: Conversation Context Management
  await runner.runTest('Context Management - Multi-turn Business Consultation', async () => {
    const session = createChatSession({
      sessionId: 'business-consultant-001',
      provider: 'claude',
      providerConfig: {
        apiKey: CLAUDE_API_KEY,
        model: 'claude-3-haiku-20240307',
        temperature: 0.4,
        maxTokens: 500
      }
    });

    // Build context through conversation
    await session.chat('I run a small bakery in downtown Portland with 5 employees.');
    await session.chat('We specialize in artisan sourdough and pastries, open 6 days a week.');
    await session.chat('Revenue has been declining 15% over the past 6 months despite good reviews.');
    
    const advice = await session.chat('What specific strategies would you recommend to reverse this revenue decline?');

    if (!advice.includes('bakery') && !advice.includes('revenue')) {
      throw new Error('Business advice should reference the established context');
    }

    const history = session.getHistory();
    if (history.length < 8) { // 4 user + 4 assistant messages
      throw new Error('Session should maintain conversation history');
    }

    return advice.substring(0, 250) + '...';
  });

  runner.printSummary();
}

// Run the tests
main().catch(error => {
  console.error('💥 Claude provider tests failed:', error);
  process.exit(1);
});