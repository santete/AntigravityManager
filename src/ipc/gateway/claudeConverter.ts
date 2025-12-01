export enum ResponseType {
  None = 0,
  Thinking = 1,
  Text = 2,
  Tool = 3,
}

export interface StreamEvent {
  event: string;
  data: string;
}

export class ClaudeStreamConverter {
  public responseIndex: number = 0;
  public currentType: ResponseType = ResponseType.None;
  public hasContent: boolean = false;

  constructor() {}

  processChunk(jsonChunk: any): StreamEvent[] {
    const events: StreamEvent[] = [];

    // 0. Handle Prompt Feedback (Blocked requests)
    if (!jsonChunk.candidates && !jsonChunk.choices) {
      if (jsonChunk.promptFeedback) {
        console.warn(
          `(Anthropic) Received promptFeedback (likely blocked): ${JSON.stringify(jsonChunk.promptFeedback)}`,
        );
      }
      return events;
    }

    const choices = jsonChunk.choices;
    if (!choices || choices.length === 0) return events;

    const choice = choices[0];
    const delta = choice.delta;

    const deltaContent = delta.content || delta.text || ''; // Support both content and text fields just in case
    const isThought = delta.thought === true || !!delta.thinking; // Check for thinking flag or content
    const thinkingContent = delta.thinking || '';
    const thoughtSignature = delta.thoughtSignature;

    // If we have content of any kind
    if (deltaContent || isThought || thoughtSignature || thinkingContent) {
      this.hasContent = true;
    }

    // 1. Handle Thinking
    // If it is explicitly marked as thought, or has thinking content
    if (isThought || thoughtSignature || thinkingContent) {
      // Close Text if open
      if (this.currentType === ResponseType.Text) {
        events.push(
          this.createEvent('content_block_stop', {
            type: 'content_block_stop',
            index: this.responseIndex,
          }),
        );
        this.responseIndex++;
        this.currentType = ResponseType.None;
      }

      // Open Thinking if not open
      if (this.currentType === ResponseType.None) {
        events.push(
          this.createEvent('content_block_start', {
            type: 'content_block_start',
            index: this.responseIndex,
            content_block: { type: 'thinking', thinking: '' }, // Anthropic Beta expects 'thinking' block
          }),
        );
        this.currentType = ResponseType.Thinking;
      }

      if (thinkingContent) {
        events.push(
          this.createEvent('content_block_delta', {
            type: 'content_block_delta',
            index: this.responseIndex,
            delta: { type: 'thinking_delta', thinking: thinkingContent },
          }),
        );
      }
    }
    // 2. Handle Regular Text
    else if (deltaContent) {
      // Close Thinking if open
      if (this.currentType === ResponseType.Thinking) {
        events.push(
          this.createEvent('content_block_stop', {
            type: 'content_block_stop',
            index: this.responseIndex,
          }),
        );
        this.responseIndex++;
        this.currentType = ResponseType.None;
      }

      // Open Text if not open
      if (this.currentType === ResponseType.None) {
        events.push(
          this.createEvent('content_block_start', {
            type: 'content_block_start',
            index: this.responseIndex,
            content_block: { type: 'text', text: '' },
          }),
        );
        this.currentType = ResponseType.Text;
      }

      events.push(
        this.createEvent('content_block_delta', {
          type: 'content_block_delta',
          index: this.responseIndex,
          delta: { type: 'text_delta', text: deltaContent },
        }),
      );
    }

    // 3. Handle Stop Reason
    if (choice.finish_reason) {
      // Close any open block
      if (this.currentType !== ResponseType.None) {
        events.push(
          this.createEvent('content_block_stop', {
            type: 'content_block_stop',
            index: this.responseIndex,
          }),
        );
        this.responseIndex++;
        this.currentType = ResponseType.None;
      }

      let stopReason = 'end_turn';
      const r = choice.finish_reason;
      if (r === 'length' || r === 'MAX_TOKENS') stopReason = 'max_tokens';
      else if (r === 'tool_calls') stopReason = 'tool_use';
      // Safety mappings
      else if (r === 'SAFETY' || r === 'RECITATION') stopReason = 'end_turn'; // Fallback

      events.push(
        this.createEvent('message_delta', {
          type: 'message_delta',
          delta: { stop_reason: stopReason, stop_sequence: null },
          usage: { output_tokens: 0 },
        }),
      );

      events.push(
        this.createEvent('message_stop', {
          type: 'message_stop',
        }),
      );
    }

    return events;
  }

  static createMessageStart(msgId: string, model: string): StreamEvent {
    return {
      event: 'message_start',
      data: JSON.stringify({
        type: 'message_start',
        message: {
          id: msgId,
          type: 'message',
          role: 'assistant',
          model: model,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      }),
    };
  }

  createEvent(name: string, data: any): StreamEvent {
    return {
      event: name,
      data: JSON.stringify(data),
    };
  }
}
