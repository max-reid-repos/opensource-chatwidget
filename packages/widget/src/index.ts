import { ChatWidget } from './widget';
import type { ChatWidgetConfig, ChatCategory, ChatMessage } from './types';

// Export types
export type { ChatWidgetConfig, ChatCategory, ChatMessage };

// Export class for ES module usage
export { ChatWidget };

// Global init function for UMD/script tag usage
let instance: ChatWidget | null = null;

export function init(config: ChatWidgetConfig): ChatWidget {
  if (instance) {
    console.warn('[ChatWidget] Already initialized. Call destroy() first to reinitialize.');
    return instance;
  }
  instance = new ChatWidget(config);
  return instance;
}

export function destroy(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}

export function open(): void {
  instance?.open();
}

export function close(): void {
  instance?.close();
}

// Auto-attach to window for UMD builds
if (typeof window !== 'undefined') {
  (window as any).ChatWidget = {
    init,
    destroy,
    open,
    close,
    ChatWidget,
  };
}
