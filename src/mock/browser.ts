import { setupWorker } from 'msw/browser';
import { marketHandlers } from './handlers/market';
import { signalHandlers } from './handlers/signals';
import { strategyHandlers } from './handlers/strategies';
import { stockHandlers } from './handlers/stocks';
import { watchlistHandlers } from './handlers/watchlist';
import { newsHandlers } from './handlers/news';
import { userHandlers } from './handlers/user';
import { sandboxHandlers } from './handlers/sandbox';

const allHandlers = [
  ...marketHandlers,
  ...signalHandlers,
  ...strategyHandlers,
  ...stockHandlers,
  ...watchlistHandlers,
  ...newsHandlers,
  ...userHandlers,
  ...sandboxHandlers,
];

export const worker = setupWorker(...allHandlers);

export async function initMockBrowser(): Promise<void> {
  const { worker } = await import('./browser');
  await worker.start({
    onUnhandledRequest: 'bypass',
  });
}
