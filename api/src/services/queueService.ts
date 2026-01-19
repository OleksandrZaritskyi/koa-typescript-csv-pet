import { EventEmitter } from 'events';

export class InMemoryQueue<T> {
  private readonly items: T[] = [];
  private readonly events = new EventEmitter();

  enqueue(item: T): void {
    this.items.push(item);
    this.events.emit('enqueue');
  }

  dequeue(): T | undefined {
    return this.items.shift();
  }

  size(): number {
    return this.items.length;
  }

  onEnqueue(listener: () => void): void {
    this.events.on('enqueue', listener);
  }
}
