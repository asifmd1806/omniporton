/**
 * Integration tests for other providers (Mistral, Groq) with real-world examples
 */

import 'dotenv/config';
import { 
  createChatSession, 
  createAgent,
  createMonitoringService,
  Utils
} from '../../dist/index.js';

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  duration: number;
  output?: any;
}

class TestRunner {
  private results: TestResult[] = [];

  async runTest(name: string, testFn: () => Promise<any>, skipCondition?: boolean): Promise<void> {
    if (skipCondition) {
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
    const successful = this.results.filter(r => r.success).length;
    const total = this.results.length;
    const skipped = !MISTRAL_API_KEY && !GROQ_API_KEY;

    console.log('\n' + '='.repeat(60));
    console.log('📊 OTHER PROVIDERS TEST SUMMARY');
    console.log('='.repeat(60));
    
    if (skipped) {
      console.log('⚠️  All tests skipped - set MISTRAL_API_KEY and/or GROQ_API_KEY to run');
      return;
    }

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
  console.log('🚀 Other Providers Integration Tests');
  console.log('===================================\n');

  const runner = new TestRunner();

  // Test 1: Mistral Provider - French Language Content
  await runner.runTest('Mistral Provider - French Business Translation', async () => {
    const session = createChatSession({
      sessionId: 'mistral-french-001',
      provider: 'mistral',
      providerConfig: {
        apiKey: MISTRAL_API_KEY,
        model: 'mistral-small',
        temperature: 0.3
      }
    });

    const englishContract = `CONFIDENTIALITY AGREEMENT

This Confidentiality Agreement ("Agreement") is entered into between TechCorp Solutions ("Disclosing Party") and Innovation Labs ("Receiving Party").

1. CONFIDENTIAL INFORMATION: Any technical data, trade secrets, know-how, research, product plans, products, services, customers, customer lists, markets, software, developments, inventions, processes, formulas, technology, designs, drawings, engineering, hardware configuration information, marketing, finances, or other business information.

2. OBLIGATIONS: The Receiving Party agrees to hold and maintain the Confidential Information in strict confidence and not to disclose such information to any third parties.

3. TERM: This Agreement shall remain in effect for a period of five (5) years from the date of execution.`;

    const request = `Traduisez ce contrat de confidentialité en français professionnel, en conservant tous les termes juridiques appropriés:\n\n${englishContract}`;

    const translation = await session.chat(request);

    if (!translation.includes('ACCORD DE CONFIDENTIALITÉ') && !translation.includes('CONFIDENTIALITÉ')) {
      throw new Error('French translation should include proper legal terminology');
    }

    return translation.substring(0, 300) + '...';
  }, !MISTRAL_API_KEY);

  // Test 2: Mistral Provider - Code Generation
  await runner.runTest('Mistral Provider - Algorithm Implementation', async () => {
    const agent = createAgent({
      id: 'mistral-coder',
      name: 'Mistral Code Generator',
      description: 'Specialized in generating efficient algorithms and code solutions',
      provider: 'mistral',
      providerConfig: {
        apiKey: MISTRAL_API_KEY,
        model: 'mistral-small',
        temperature: 0.1
      },
      systemPrompt: 'You are an expert programmer. Write clean, efficient, well-documented code with error handling.'
    });

    const codingTask = `Implement a Python class for a LRU (Least Recently Used) cache with the following requirements:

1. Initialize with a maximum capacity
2. get(key) - Return value if key exists, else return None
3. put(key, value) - Insert or update the value. If capacity exceeded, remove LRU item
4. Both operations should be O(1) time complexity
5. Include proper type hints and docstrings
6. Add example usage

Focus on efficiency and clean code structure.`;

    const implementation = await agent.execute(codingTask);

    if (!implementation.includes('class') || !implementation.includes('def get') || !implementation.includes('def put')) {
      throw new Error('Implementation should include LRU cache class with required methods');
    }

    return implementation.substring(0, 400) + '...';
  }, !MISTRAL_API_KEY);

  // Test 3: Mistral Provider - Scientific Research
  await runner.runTest('Mistral Provider - Research Paper Analysis', async () => {
    const session = createChatSession({
      sessionId: 'mistral-research-001',
      provider: 'mistral',
      providerConfig: {
        apiKey: MISTRAL_API_KEY,
        model: 'mistral-small',
        temperature: 0.2
      }
    });

    const researchAbstract = `Abstract: Machine learning models for medical diagnosis have shown promising results, but their deployment in clinical settings faces significant challenges related to interpretability, bias, and regulatory approval. This study presents a novel approach using explainable AI (XAI) techniques to improve the transparency of deep learning models for radiological image analysis. We developed a CNN-based system for pneumonia detection in chest X-rays, enhanced with LIME and SHAP explainability methods. Our model achieved 94.2% accuracy, 91.8% sensitivity, and 96.1% specificity on a dataset of 10,000 chest X-ray images. The explainability components successfully highlighted relevant anatomical regions, improving clinician trust and facilitating regulatory review. These findings suggest that XAI-enhanced medical AI systems can bridge the gap between high-performance models and clinical acceptability.`;

    const analysisRequest = `Analysez cet abstract de recherche médicale et fournissez:

1. Résumé des objectifs de l'étude
2. Méthodologie employée  
3. Résultats clés et métriques de performance
4. Implications cliniques
5. Limitations potentielles et futures recherches

Répondez en français avec une analyse critique et constructive.`;

    const analysis = await session.chat(analysisRequest);

    if (!analysis.includes('méthodologie') && !analysis.includes('résultats')) {
      throw new Error('French research analysis should include methodology and results discussion');
    }

    return analysis.substring(0, 300) + '...';
  }, !MISTRAL_API_KEY);

  // Test 4: Groq Provider - High-Speed Code Analysis
  await runner.runTest('Groq Provider - Real-time Code Review', async () => {
    const session = createChatSession({
      sessionId: 'groq-code-review-001',
      provider: 'groq',
      providerConfig: {
        apiKey: GROQ_API_KEY,
        model: 'llama2-70b-4096',
        temperature: 0.3
      }
    });

    const codeToReview = `
import asyncio
import aiohttp
import json
from typing import List, Dict, Optional

class APIClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.api_key = api_key
        self.session = None
    
    async def get_user_data(self, user_ids: List[int]) -> Dict:
        results = {}
        for user_id in user_ids:
            async with aiohttp.ClientSession() as session:
                headers = {"Authorization": f"Bearer {self.api_key}"}
                url = f"{self.base_url}/users/{user_id}"
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        results[user_id] = data
                    else:
                        print(f"Error fetching user {user_id}: {response.status}")
        return results
    
    def save_to_file(self, data, filename):
        with open(filename, 'w') as f:
            json.dump(data, f)`;

    const reviewRequest = `Review this Python code for performance issues, security concerns, and best practices. Provide specific recommendations for improvement:

${codeToReview}

Focus on:
1. Async/await usage and performance
2. Error handling and resilience  
3. Security considerations
4. Code structure and maintainability
5. Resource management`;

    const review = await session.chat(reviewRequest);

    if (!review.includes('session') && !review.includes('async')) {
      throw new Error('Code review should address async programming patterns');
    }

    return review.substring(0, 300) + '...';
  }, !GROQ_API_KEY);

  // Test 5: Groq Provider - Mathematical Problem Solving
  await runner.runTest('Groq Provider - Complex Mathematical Analysis', async () => {
    const agent = createAgent({
      id: 'groq-mathematician',
      name: 'Groq Math Solver',
      description: 'High-speed mathematical problem solver and analyst',
      provider: 'groq',
      providerConfig: {
        apiKey: GROQ_API_KEY,
        model: 'llama2-70b-4096',
        temperature: 0.1
      },
      systemPrompt: 'You are a mathematics expert. Solve problems step-by-step with clear explanations and verify your work.'
    });

    const mathProblem = `OPTIMIZATION PROBLEM:

A company produces two products: Widget A and Widget B.

Constraints:
- Widget A requires 2 hours of labor and 3 units of material
- Widget B requires 4 hours of labor and 1 unit of material  
- Available: 240 hours of labor per week, 180 units of material per week
- Profit: $15 per Widget A, $20 per Widget B

Question: What production mix maximizes weekly profit?

Solve using linear programming. Show:
1. Objective function and constraints
2. Graphical analysis or simplex method
3. Optimal solution with maximum profit
4. Sensitivity analysis for labor constraint`;

    const solution = await agent.execute(mathProblem);

    if (!solution.includes('objective') || !solution.includes('constraint')) {
      throw new Error('Mathematical solution should include objective function and constraints');
    }

    if (!solution.includes('optimal') && !solution.includes('maximum')) {
      throw new Error('Solution should identify optimal production mix');
    }

    return solution.substring(0, 400) + '...';
  }, !GROQ_API_KEY);

  // Test 6: Cross-Provider Comparison
  await runner.runTest('Cross-Provider Performance - Response Speed Comparison', async () => {
    const prompt = 'Explain quantum computing in exactly 100 words.';
    const results: Array<{provider: string, duration: number, responseLength: number}> = [];

    // Test Mistral if available
    if (MISTRAL_API_KEY) {
      try {
        const mistralSession = createChatSession({
          sessionId: 'speed-test-mistral',
          provider: 'mistral',
          providerConfig: {
            apiKey: MISTRAL_API_KEY,
            model: 'mistral-small'
          }
        });

        const startTime = Date.now();
        const response = await mistralSession.chat(prompt);
        const duration = Date.now() - startTime;
        
        results.push({
          provider: 'Mistral',
          duration,
          responseLength: response.length
        });
      } catch (error) {
        console.warn('Mistral speed test failed:', error);
      }
    }

    // Test Groq if available
    if (GROQ_API_KEY) {
      try {
        const groqSession = createChatSession({
          sessionId: 'speed-test-groq',
          provider: 'groq',
          providerConfig: {
            apiKey: GROQ_API_KEY,
            model: 'llama2-70b-4096'
          }
        });

        const startTime = Date.now();
        const response = await groqSession.chat(prompt);
        const duration = Date.now() - startTime;
        
        results.push({
          provider: 'Groq',
          duration,
          responseLength: response.length
        });
      } catch (error) {
        console.warn('Groq speed test failed:', error);
      }
    }

    if (results.length === 0) {
      return 'No providers available for speed comparison';
    }

    const summary = results.map(r => 
      `${r.provider}: ${r.duration}ms (${r.responseLength} chars)`
    ).join(', ');

    return `Speed comparison - ${summary}`;
  }, !MISTRAL_API_KEY && !GROQ_API_KEY);

  // Test 7: Error Handling Across Providers
  await runner.runTest('Error Handling - Provider Resilience Testing', async () => {
    const errorScenarios = [];

    // Test Mistral error handling
    if (MISTRAL_API_KEY) {
      try {
        const session = createChatSession({
          sessionId: 'error-test-mistral',
          provider: 'mistral',
          providerConfig: {
            apiKey: MISTRAL_API_KEY,
            model: 'mistral-small'
          }
        });

        // Test with very long prompt that might cause issues
        const longPrompt = 'Explain machine learning. ' + 'Provide comprehensive details. '.repeat(200);
        
        try {
          await session.chat(longPrompt);
          errorScenarios.push('Mistral: Handled long prompt successfully');
        } catch (error) {
          if (error instanceof Error) {
            errorScenarios.push(`Mistral: Correctly handled error - ${error.message.substring(0, 50)}`);
          }
        }
      } catch (setupError) {
        errorScenarios.push('Mistral: Setup error handled');
      }
    }

    // Test Groq error handling
    if (GROQ_API_KEY) {
      try {
        const session = createChatSession({
          sessionId: 'error-test-groq',
          provider: 'groq',
          providerConfig: {
            apiKey: GROQ_API_KEY,
            model: 'invalid-model-name' // This should cause an error
          }
        });

        try {
          await session.chat('Test message');
          errorScenarios.push('Groq: Unexpected success with invalid model');
        } catch (error) {
          if (error instanceof Error) {
            errorScenarios.push(`Groq: Correctly handled model error - ${error.message.substring(0, 50)}`);
          }
        }
      } catch (setupError) {
        errorScenarios.push('Groq: Setup error handled correctly');
      }
    }

    if (errorScenarios.length === 0) {
      return 'No providers available for error testing';
    }

    return errorScenarios.join('; ');
  }, !MISTRAL_API_KEY && !GROQ_API_KEY);

  runner.printSummary();
}

// Run the tests
main().catch(error => {
  console.error('💥 Other providers tests failed:', error);
  process.exit(1);
});