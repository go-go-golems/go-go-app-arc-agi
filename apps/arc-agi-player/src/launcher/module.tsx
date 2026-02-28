import type { LaunchableAppModule, LaunchReason } from '@hypercard/desktop-os';
import type { OpenWindowPayload } from '@hypercard/engine/desktop-core';
import type { DesktopContribution, WindowContentAdapter } from '@hypercard/engine/desktop-react';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { Provider } from 'react-redux';

import { createArcPlayerStore } from '../app/store';
import { ArcPlayerWindow } from '../components/ArcPlayerWindow';

// --- Window payload builders ---

function buildMainWindowPayload(reason?: LaunchReason): OpenWindowPayload {
  return {
    id: 'window:arc-agi-player:main',
    title: 'ARC-AGI',
    bounds: { x: 80, y: 40, w: 680, h: 520 },
    content: { kind: 'app', appKey: 'arc-agi-player:main' },
    dedupeKey: reason === 'startup' ? 'arc-agi-player:main:startup' : 'arc-agi-player:main',
  };
}

export function buildGameWindowPayload(gameId: string, gameName?: string): OpenWindowPayload {
  return {
    id: `window:arc-agi-player:game:${gameId}`,
    title: gameName ?? gameId,
    bounds: { x: 100, y: 60, w: 680, h: 520 },
    content: { kind: 'app', appKey: `arc-agi-player:game:${gameId}` },
    dedupeKey: `arc-agi-player:game:${gameId}`,
  };
}

// --- Window content adapter ---

function createArcPlayerAdapter(): WindowContentAdapter {
  return {
    id: 'arc-agi-player.windows',
    canRender: (window) => {
      if (window.content.kind !== 'app') return false;
      const key = window.content.appKey ?? '';
      return key.startsWith('arc-agi-player:');
    },
    render: (window) => {
      const key = window.content.appKey ?? '';
      if (key === 'arc-agi-player:main') {
        return (
          <ArcPlayerHost>
            <ArcPlayerWindow />
          </ArcPlayerHost>
        );
      }
      const gameMatch = key.match(/^arc-agi-player:game:(.+)$/);
      if (gameMatch) {
        return (
          <ArcPlayerHost>
            <ArcPlayerWindow initialGameId={gameMatch[1]} />
          </ArcPlayerHost>
        );
      }
      return (
        <ArcPlayerHost>
          <ArcPlayerWindow />
        </ArcPlayerHost>
      );
    },
  };
}

// --- Provider host ---

function ArcPlayerHost({ children }: { children: ReactNode }) {
  const storeRef = useRef<ReturnType<typeof createArcPlayerStore> | null>(null);
  if (!storeRef.current) {
    storeRef.current = createArcPlayerStore();
  }
  return <Provider store={storeRef.current}>{children}</Provider>;
}

// --- Module export ---

export const arcPlayerLauncherModule: LaunchableAppModule = {
  manifest: {
    id: 'arc-agi-player',
    name: 'ARC-AGI',
    icon: '\uD83C\uDFAE',
    launch: { mode: 'window' },
    desktop: { order: 80 },
  },

  buildLaunchWindow: (_ctx, reason) => buildMainWindowPayload(reason),

  createContributions: (): DesktopContribution[] => [
    {
      id: 'arc-agi-player.window-adapters',
      windowContentAdapters: [createArcPlayerAdapter()],
    },
  ],

  renderWindow: ({ windowId }): ReactNode => (
    <ArcPlayerHost key={windowId}>
      <ArcPlayerWindow />
    </ArcPlayerHost>
  ),
};
