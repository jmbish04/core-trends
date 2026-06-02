/**
 * @fileoverview Repository Intelligence Agent using Cloudflare Agents SDK
 *
 * This agent evaluates GitHub repositories and provides intelligent scoring
 * using AI models. It maintains conversation history in Durable Object SQLite
 * and mirrors important data to D1 for dashboard queries.
 */

import { AIChatAgent } from "@cloudflare/ai-chat";
import type { Bindings } from "../api/index";

export interface RepoIntelState {
  lastEvaluationId?: number;
  totalEvaluations: number;
  sessionStartTime: number;
}

/**
 * Repository Intelligence Agent - Extends AIChatAgent for AI-powered repository evaluation
 *
 * This agent:
 * - Maintains conversation history in Durable Object SQLite (hot state)
 * - Evaluates repositories using AI models
 * - Mirrors data to D1 database for dashboard queries (cold state)
 */
export class RepositoryIntelligenceAgent extends AIChatAgent<Bindings, RepoIntelState> {
  /**
   * Handle incoming chat messages with AI-powered repository analysis
   */
  async onChatMessage(finish?: any) {
    // System prompt for repository evaluation context
    const systemPrompt = `You are the Monolith Repository Intelligence Architect.

You specialize in:
- Evaluating GitHub repositories for quality, maintainability, and innovation
- Analyzing code architecture patterns and design principles
- Assessing Cloudflare Workers compatibility
- Providing actionable insights for developers

When evaluating repositories, consider:
1. Code quality and organization
2. Documentation completeness
3. Community engagement (stars, forks, issues)
4. Active maintenance status
5. Cloudflare Workers/Edge compatibility
6. Modern web standards adherence

Provide scores from 1-10 with clear rationale.`;

    try {
      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...this.messages.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
        })),
      ];

      const result = await this.env.AI.run(
        "@cf/meta/llama-3.1-8b-instruct",
        { messages, stream: true }
      );

      // Collect the streamed response for mirroring to D1
      const response = result as ReadableStream;
      const [mirrorStream, responseStream] = response.tee();

      // Mirror evaluation data to D1 using ctx.waitUntil() for non-blocking persistence
      this.ctx.waitUntil(
        (async () => {
          const reader = mirrorStream.getReader();
          const decoder = new TextDecoder();
          let fullText = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullText += decoder.decode(value, { stream: true });
          }
          await this.mirrorEvaluationToD1(fullText);
          if (finish) await finish({ text: fullText });
        })()
      );

      return new Response(responseStream, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    } catch (error) {
      console.error("AI streaming error:", error);
      throw error;
    }
  }

  /**
   * Custom RPC method to evaluate a specific repository
   */
  async evaluateRepository(repoData: {
    name: string;
    owner: string;
    description?: string;
    language: string;
    stars: number;
    url: string;
  }) {
    // Store evaluation request in agent state
    const currentState = this.state || {
      totalEvaluations: 0,
      sessionStartTime: Date.now(),
    };

    this.setState({
      ...currentState,
      totalEvaluations: currentState.totalEvaluations + 1,
    });

    // Create AI evaluation prompt
    const evaluationPrompt = `Evaluate this GitHub repository:

Repository: ${repoData.owner}/${repoData.name}
Language: ${repoData.language}
Stars: ${repoData.stars}
Description: ${repoData.description || "No description"}
URL: ${repoData.url}

Provide:
1. Quality score (1-10)
2. Detailed rationale
3. Cloudflare Workers compatibility assessment
4. Key strengths and weaknesses`;

    // Send message through the chat system
    await this.addMessage({
      role: "user",
      content: evaluationPrompt,
    });

    return {
      success: true,
      evaluationId: currentState.totalEvaluations + 1,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Mirror evaluation telemetry to D1 database for dashboard queries
   * Uses ctx.waitUntil() to run asynchronously without blocking responses
   */
  private async mirrorEvaluationToD1(aiResponse: string) {
    try {
      // Parse AI response to extract evaluation metrics
      const scoreMatch = aiResponse.match(/score[:\s]+(\d+)/i);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 7;

      // Log evaluation to D1 system logs
      await this.env.DB.prepare(
        `INSERT INTO system_logs (level, subsystem, message, metadata, created_at)
         VALUES (?, ?, ?, ?, unixepoch())`
      )
        .bind(
          "info",
          "agent_evaluator",
          `Repository evaluation completed by agent: ${this.name}`,
          JSON.stringify({ score, responseLength: aiResponse.length })
        )
        .run();
    } catch (error) {
      // Log errors using agent's SQLite storage
      this.sql`INSERT INTO system_logs (level, subsystem, message, created_at)
               VALUES ('error', 'agent_mirror', ${(error as Error).message}, unixepoch())`;
    }
  }

  /**
   * Get agent statistics
   */
  async getStats() {
    const state = this.state || {
      totalEvaluations: 0,
      sessionStartTime: Date.now(),
    };

    return {
      agentName: this.name,
      totalEvaluations: state.totalEvaluations,
      sessionStartTime: state.sessionStartTime,
      uptime: Date.now() - state.sessionStartTime,
    };
  }
}
