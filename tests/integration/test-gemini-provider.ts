/**
 * Integration tests for Gemini provider with real-world examples
 */

import 'dotenv/config';
import { 
  createChatSession, 
  createAgent,
  createMonitoringService,
  Utils
} from '../../dist/index.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const SKIP_TESTS = !GEMINI_API_KEY;

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
      console.log('\n⚠️  All Gemini tests skipped - set GEMINI_API_KEY or GOOGLE_API_KEY to run');
      return;
    }

    const successful = this.results.filter(r => r.success).length;
    const total = this.results.length;

    console.log('\n' + '='.repeat(60));
    console.log('📊 GEMINI PROVIDER TEST SUMMARY');
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
  console.log('🚀 Gemini Provider Integration Tests');
  console.log('===================================\n');

  const runner = new TestRunner();

  // Test 1: Educational Content Creation
  await runner.runTest('Educational Content - Interactive Learning Module', async () => {
    const agent = createAgent({
      id: 'education-specialist',
      name: 'Educational Content Creator',
      description: 'Expert in creating engaging educational content and learning materials',
      provider: 'gemini',
      providerConfig: {
        apiKey: GEMINI_API_KEY,
        model: 'gemini-1.5-flash',
        temperature: 0.6
      },
      systemPrompt: `You are an educational content specialist. Create engaging, interactive learning materials that:
1. Break down complex concepts into digestible parts
2. Include practical examples and analogies
3. Provide assessment questions
4. Adapt to different learning styles`
    });

    const lessonRequest = `Create an interactive lesson module on "Photosynthesis" for 8th grade students (ages 13-14).

Include:
1. Learning objectives
2. Key concepts with simple explanations
3. Real-world examples and analogies
4. 3 practice questions (multiple choice)
5. A hands-on activity suggestion

Make it engaging and age-appropriate with clear structure.`;

    const lesson = await agent.execute(lessonRequest);

    if (!lesson.includes('photosynthesis') || !lesson.includes('objective')) {
      throw new Error('Educational content should include lesson objectives and key topic');
    }

    return lesson.substring(0, 300) + '...';
  });

  // Test 2: Multilingual Translation and Localization
  await runner.runTest('Multilingual Support - Business Communication', async () => {
    const session = createChatSession({
      sessionId: 'translator-001',
      provider: 'gemini',
      providerConfig: {
        apiKey: GEMINI_API_KEY,
        model: 'gemini-1.5-flash',
        temperature: 0.3
      }
    });

    const businessEmail = `Subject: Partnership Proposal - Sustainable Technology Solutions

Dear Ms. Rodriguez,

I hope this email finds you well. I am writing to explore potential partnership opportunities between our companies in the sustainable technology sector.

Our company, GreenTech Innovations, has developed revolutionary solar panel efficiency technology that increases energy output by 35% while reducing manufacturing costs by 20%. We believe this aligns perfectly with your company's commitment to renewable energy solutions.

Would you be available for a 30-minute video call next week to discuss how we might collaborate? I'm confident that together we can make a significant impact on the clean energy market.

Best regards,
Dr. Sarah Johnson
CEO, GreenTech Innovations`;

    const request = `Please translate this business email to Spanish, maintaining professional tone and business etiquette appropriate for Spanish-speaking markets:\n\n${businessEmail}`;

    const translation = await session.chat(request);

    if (!translation.includes('Estimada') && !translation.includes('Sr') && !translation.includes('Sra')) {
      throw new Error('Spanish translation should use appropriate business salutations');
    }

    if (!translation.includes('tecnología') || !translation.includes('sostenible')) {
      throw new Error('Translation should include key technical terms');
    }

    return translation.substring(0, 300) + '...';
  });

  // Test 3: Creative Problem Solving
  await runner.runTest('Creative Problem Solving - Product Innovation', async () => {
    const session = createChatSession({
      sessionId: 'innovation-lab-001',
      provider: 'gemini',
      providerConfig: {
        apiKey: GEMINI_API_KEY,
        model: 'gemini-1.5-flash',
        temperature: 0.8
      }
    });

    const innovationChallenge = `INNOVATION CHALLENGE: Urban Food Waste Reduction

Context: Major cities waste 30-40% of food while 1 in 8 residents face food insecurity.

Constraints:
- Solution must be scalable to cities of 1+ million people
- Budget under $50M for initial deployment
- Must integrate with existing infrastructure
- Should create economic incentives for participation
- Environmentally sustainable

Generate 3 innovative solutions that address this challenge. For each solution, provide:
1. Core concept and mechanism
2. Key stakeholders and their roles
3. Revenue model or sustainability plan
4. Potential challenges and mitigation strategies
5. Success metrics

Think creatively and consider emerging technologies.`;

    const solutions = await session.chat(innovationChallenge);

    if (!solutions.includes('food waste') || solutions.split('Solution').length < 3) {
      throw new Error('Should provide multiple innovative solutions to the challenge');
    }

    return solutions.substring(0, 350) + '...';
  });

  // Test 4: Scientific Research Analysis
  await runner.runTest('Scientific Research - Climate Data Analysis', async () => {
    const agent = createAgent({
      id: 'climate-researcher',
      name: 'Climate Research Analyst',
      description: 'Specialist in climate science data analysis and environmental research',
      provider: 'gemini',
      providerConfig: {
        apiKey: GEMINI_API_KEY,
        model: 'gemini-1.5-flash',
        temperature: 0.2
      },
      systemPrompt: 'You are a climate scientist. Analyze data rigorously, cite methodologies, and provide evidence-based conclusions with appropriate uncertainty quantification.'
    });

    const climateData = `CLIMATE DATA ANALYSIS REQUEST

Dataset: Arctic Sea Ice Extent (1979-2023)
- Average September ice extent: 1979-1989: 7.2 million km²
- Average September ice extent: 2014-2023: 4.8 million km²
- Rate of decline: -13.1% per decade
- 2023 minimum: 4.23 million km² (6th lowest on record)

Temperature correlations:
- Arctic warming rate: 2.5x global average
- September Arctic temperature anomaly (2023): +2.1°C above 1981-2010 average

Questions for analysis:
1. What does this data indicate about Arctic climate trends?
2. What are the confidence levels and uncertainties?
3. What are potential implications for global climate systems?
4. What additional data would strengthen this analysis?`;

    const analysis = await agent.execute(climateData);

    if (!analysis.includes('trend') || !analysis.includes('decline')) {
      throw new Error('Climate analysis should identify clear trends in the data');
    }

    if (!analysis.includes('uncertainty') && !analysis.includes('confidence')) {
      throw new Error('Scientific analysis should address uncertainty and confidence levels');
    }

    return analysis.substring(0, 300) + '...';
  });

  // Test 5: Multimodal Visual Analysis
  await runner.runTest('Multimodal Analysis - Infographic Interpretation', async () => {
    const session = createChatSession({
      sessionId: 'visual-analyst-001',
      provider: 'gemini',
      providerConfig: {
        apiKey: GEMINI_API_KEY,
        model: 'gemini-1.5-flash',
        temperature: 0.4
      }
    });

    // Use a data visualization image
    const chartImage = Utils.createImageFromUrl('https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/GDP_PPP_Per_Capita_IMF_2017.png/1200px-GDP_PPP_Per_Capita_IMF_2017.png');
    
    const analysisRequest = Utils.createMultiModalContent([
      'Analyze this economic data visualization and provide insights:',
      chartImage,
      '\nPlease provide:\n1. Description of what the chart shows\n2. Key patterns or trends visible\n3. Top performing countries/regions\n4. Potential economic insights\n5. Questions this data raises for further investigation'
    ]);

    const analysis = await session.sendMultiModal(analysisRequest);

    if (!analysis || analysis.length < 150) {
      throw new Error('Visual analysis should provide comprehensive insights');
    }

    return analysis.substring(0, 300) + '...';
  });

  // Test 6: Code Generation and Optimization
  await runner.runTest('Code Generation - Algorithm Implementation', async () => {
    const session = createChatSession({
      sessionId: 'code-generator-001',
      provider: 'gemini',
      providerConfig: {
        apiKey: GEMINI_API_KEY,
        model: 'gemini-1.5-flash',
        temperature: 0.1
      }
    });

    const codingChallenge = `CODING CHALLENGE: Implement an efficient algorithm for social network analysis

Requirements:
1. Function to find mutual connections between users
2. Calculate "degrees of separation" between any two users  
3. Identify the most connected users (influencers)
4. Detect potential communities/clusters

Constraints:
- Handle networks with 100,000+ users
- Optimize for query performance
- Use Python with appropriate data structures
- Include error handling and documentation

Please provide:
1. Complete implementation with classes/functions
2. Time/space complexity analysis
3. Usage examples
4. Testing approach`;

    const implementation = await session.chat(codingChallenge);

    if (!implementation.includes('def ') || !implementation.includes('class ')) {
      throw new Error('Code generation should include functions and classes');
    }

    if (!implementation.includes('complexity') && !implementation.includes('O(')) {
      throw new Error('Implementation should include complexity analysis');
    }

    return implementation.substring(0, 400) + '...';
  });

  // Test 7: Conversational Context and Memory
  await runner.runTest('Context Management - Project Planning Session', async () => {
    const session = createChatSession({
      sessionId: 'project-planner-001',
      provider: 'gemini',
      providerConfig: {
        apiKey: GEMINI_API_KEY,
        model: 'gemini-1.5-flash',
        temperature: 0.5
      }
    });

    // Build project context through conversation
    await session.chat('I need to plan a mobile app development project for a fitness tracking application.');
    await session.chat('The app should track workouts, nutrition, and sleep patterns with social features.');
    await session.chat('Our team has 3 developers (2 frontend, 1 backend), 1 designer, and 1 product manager.');
    await session.chat('Budget is $200,000 and we need to launch in 6 months.');
    
    const timeline = await session.chat('Based on our discussion, create a detailed project timeline with milestones, deliverables, and resource allocation.');

    if (!timeline.includes('fitness') || !timeline.includes('6 months')) {
      throw new Error('Project timeline should reference established project context');
    }

    if (!timeline.includes('milestone') && !timeline.includes('phase')) {
      throw new Error('Timeline should include structured project phases');
    }

    const history = session.getHistory();
    if (history.length < 10) {
      throw new Error('Session should maintain conversation history');
    }

    return timeline.substring(0, 300) + '...';
  });

  // Test 8: Error Handling and Model Limitations
  await runner.runTest('Error Handling - Edge Cases and Recovery', async () => {
    const session = createChatSession({
      sessionId: 'error-test-001',
      provider: 'gemini',
      providerConfig: {
        apiKey: GEMINI_API_KEY,
        model: 'gemini-1.5-flash',
        temperature: 0.5
      }
    });

    // Test with request that might hit content policies or limitations
    try {
      const response = await session.chat('Explain the process of photosynthesis in plants using exactly 1000 words, including detailed biochemical pathways and molecular interactions.');
      
      if (response.length < 500) {
        return 'Handled length constraint appropriately';
      }
      
      return 'Successfully generated detailed scientific explanation';
    } catch (error) {
      if (error instanceof Error) {
        // Check if it's a handled API error
        if (error.message.includes('content') || error.message.includes('policy')) {
          return 'Correctly handled content policy restriction';
        }
        if (error.message.includes('rate') || error.message.includes('quota')) {
          return 'Correctly handled rate limiting';
        }
      }
      throw error;
    }
  });

  runner.printSummary();
}

// Run the tests
main().catch(error => {
  console.error('💥 Gemini provider tests failed:', error);
  process.exit(1);
});