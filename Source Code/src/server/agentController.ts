/**
 * Agent Controller
 * Orchestrates the Observe -> Think -> Execute -> Decide -> Repeat agent cycles.
 */

import { DockerExecutor } from "./dockerExecutor.js";
import { LLMService, IntentOutput } from "./llmService.js";

export interface AgentStep {
  loopNumber: number;
  action: string;
  target?: string;
  thoughts: string;
  observation: any;
}

export interface AgentResult {
  query: string;
  initialIntent: IntentOutput;
  steps: AgentStep[];
  commentary: string;
  containersAtEnd: any;
  blockedActionTriggered?: boolean;
  matchedContainerNames?: string[];
}

export class AgentController {
  /**
   * Main Agent Loop Execution
   * Drives cognitive loops to deep-inspect docker container states
   */
  static async runAgent(query: string): Promise<AgentResult> {
    const steps: AgentStep[] = [];
    
    // Phase 1: NL Translation Core
    const initialIntent = await LLMService.translate(query);

    // Prepare first loop state
    let nextAction = initialIntent.intent;
    let nextTarget = initialIntent.containerName || initialIntent.target;
    let currentThoughts = initialIntent.reasoning;
    let shouldStop = false;

    // Tick the simulation to fluctuate metrics slightly on new actions
    DockerExecutor.tickSimulation();

    // Limit execution to maximum 3 loops
    for (let loop = 1; loop <= 3; loop++) {
      // Step A: Execute the decided action
      console.log(`[Agent Controller] Loop ${loop} - Executing action: "${nextAction}" target: "${nextTarget}"`);
      const executionResult = await DockerExecutor.executeAction(nextAction, nextTarget);

      // Check if security violation occurred during execution check
      if (executionResult.isBlocked) {
        steps.push({
          loopNumber: loop,
          action: nextAction,
          target: nextTarget,
          thoughts: currentThoughts,
          observation: { error: executionResult.error, isBlocked: true }
        });
        
        const finalContainers = await DockerExecutor.getStatus();
        const filteredList = LLMService.filterContainersForQuery(finalContainers, query);
        const matchedContainerNames = filteredList.map(c => c.name);
        
        return {
          query,
          initialIntent,
          steps,
          commentary: `### 🛑 Security Guardrails Triggered\nDuring agent investigation, a command execution was flagged as blocked: ${executionResult.error}`,
          containersAtEnd: finalContainers,
          blockedActionTriggered: true,
          matchedContainerNames
        };
      }

      // Step B: Observe outcome
      const currentObservation = executionResult.success ? executionResult.data || executionResult : { error: executionResult.error };

      // Save step state
      const currentStep: AgentStep = {
        loopNumber: loop,
        action: nextAction,
        target: nextTarget,
        thoughts: currentThoughts,
        observation: currentObservation
      };
      steps.push(currentStep);

      // If execution itself was an error or we need to stop, check
      if (!executionResult.success) {
        shouldStop = true;
      }

      if (shouldStop || loop === 3) {
        break;
      }

      // Step C: Mind Consult (Think & Decide next step)
      try {
        const consultation = await LLMService.consultAgentModel({
          goal: query,
          loopNumber: loop,
          history: steps.map(s => ({
            loop: s.loopNumber,
            action: s.action,
            target: s.target,
            thoughts: s.thoughts
          })),
          currentObservation
        });

        // Update loop bindings
        nextAction = consultation.action as any;
        nextTarget = consultation.target;
        currentThoughts = consultation.reasoning;
        shouldStop = consultation.stop;

      } catch (err: any) {
        console.error("Consultation run error:", err.message);
        shouldStop = true;
      }
    }

    // Phase 5: AI Commentary
    const commentary = await LLMService.explainDockerStatus({
      query,
      agentHistory: steps
    });

    const finalContainers = await DockerExecutor.getStatus();
    const filteredList = LLMService.filterContainersForQuery(finalContainers, query);
    const matchedContainerNames = filteredList.map(c => c.name);

    return {
      query,
      initialIntent,
      steps,
      commentary,
      containersAtEnd: finalContainers,
      matchedContainerNames
    };
  }
}
