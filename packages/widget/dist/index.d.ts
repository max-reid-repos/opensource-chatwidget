import { ChatWidget } from './widget';
import type { ChatWidgetConfig, ChatCategory, ChatMessage } from './types';
export type { ChatWidgetConfig, ChatCategory, ChatMessage };
export { ChatWidget };
export declare function init(config: ChatWidgetConfig): ChatWidget;
export declare function destroy(): void;
export declare function open(): void;
export declare function close(): void;
