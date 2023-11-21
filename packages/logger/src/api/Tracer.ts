import { Manager } from './Manager';
import { SpanContext } from './opentelemetry';
import { SpanStruct } from './Span';
import { SpanOptions as TSpanOptions } from '@opentelemetry/api/build/src/trace/SpanOptions';
import { TimeInput } from '@opentelemetry/api/build/src/common/Time';

export interface TracerStruct {
  startTime: number; // Milliseconds
  endTime?: number; // Milliseconds
}

export type SpanOptions = TSpanOptions & {
  parent?: SpanContext;
};

export interface Tracer {
  manager: Manager;
  toJSON(): TracerStruct;
  createSpanContext(...args: unknown[]): SpanContext;
  createSpan(name: string, options?: SpanOptions): SpanStruct;
  start(time?: TimeInput): void;
  end(time?: TimeInput): void;
}
