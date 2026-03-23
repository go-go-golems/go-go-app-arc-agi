import type { LaunchableAppModule, LaunchReason } from '@hypercard/desktop-os';
import type { OpenWindowPayload } from '@hypercard/engine/desktop-core';
import { RuntimeSurfaceSessionHost } from '@hypercard/hypercard-runtime';
import type { DesktopContribution, WindowContentAdapter } from '@hypercard/engine/desktop-react';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { Provider } from 'react-redux';

import { createArcPlayerStore } from '../app/store';
import { ArcPendingIntentEffectHost } from '../bridge/ArcPendingIntentEffectHost';
import { ArcPlayerWindow } from '../components/ArcPlayerWindow';
import { ARC_DEMO_STACK } from '../domain/stack';

const APP_KEY_FOLDER = 'arc-agi-player:folder';
const APP_KEY_MAIN = 'arc-agi-player:main';
const APP_KEY_GAME_PREFIX = 'arc-agi-player:game:';

const ARC_WORKSPACE_INSTANCE_PREFIX = 'workspace-';
const ARC_SESSION_PREFIX = 'arc-agi-session:';

function nextInstanceId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `arc-agi-${Date.now()}`;
}

function buildFolderWindowPayload(reason?: LaunchReason): OpenWindowPayload {
  return {
    id: 'window:arc-agi-player:folder',
    title: 'ARC-AGI',
    icon: '🎮',
    bounds: { x: 92, y: 44, w: 420, h: 320 },
    content: { kind: 'app', appKey: APP_KEY_FOLDER },
    dedupeKey: reason === 'startup' ? 'arc-agi-player:folder:startup' : 'arc-agi-player:folder',
  };
}

function buildMainWindowPayload(reason?: LaunchReason): OpenWindowPayload {
  return {
    id: 'window:arc-agi-player:main',
    title: 'ARC-AGI React Player',
    bounds: { x: 80, y: 40, w: 680, h: 520 },
    content: { kind: 'app', appKey: APP_KEY_MAIN },
    dedupeKey: reason === 'startup' ? 'arc-agi-player:main:startup' : 'arc-agi-player:main',
  };
}

function buildDemoCardWindowPayload(reason?: LaunchReason): OpenWindowPayload {
  const instanceId = `${ARC_WORKSPACE_INSTANCE_PREFIX}${nextInstanceId()}`;

  return {
    id: `window:arc-agi-player:demo:${instanceId}`,
    title: 'ARC-AGI Demo Cards',
    icon: '🃏',
    bounds: { x: 120, y: 44, w: 760, h: 560 },
    content: {
      kind: 'surface',
      surface: {
        bundleId: ARC_DEMO_STACK.id,
        surfaceId: ARC_DEMO_STACK.homeSurface,
        surfaceSessionId: `${ARC_SESSION_PREFIX}${instanceId}`,
      },
    },
    dedupeKey: reason === 'startup' ? 'arc-agi-player:demo:startup' : undefined,
  };
}

export function buildGameWindowPayload(gameId: string, gameName?: string): OpenWindowPayload {
  return {
    id: `window:arc-agi-player:game:${gameId}`,
    title: gameName ?? gameId,
    bounds: { x: 100, y: 60, w: 680, h: 520 },
    content: { kind: 'app', appKey: `${APP_KEY_GAME_PREFIX}${gameId}` },
    dedupeKey: `arc-agi-player:game:${gameId}`,
  };
}

function ArcLauncherFolderWindow({
  onOpenReactGame,
  onOpenCards,
}: {
  onOpenReactGame?: () => void;
  onOpenCards?: () => void;
}) {
  return (
    <div style={{ padding: 16, display: 'grid', gap: 10 }}>
      <h3 style={{ margin: 0 }}>ARC-AGI</h3>
      <div style={{ color: '#444', fontSize: 13 }}>Choose a workspace:</div>
      <button type="button" onClick={onOpenReactGame} style={{ padding: '8px 10px' }}>
        Open React Game
      </button>
      <button type="button" onClick={onOpenCards} style={{ padding: '8px 10px' }}>
        Open HyperCard Demo Stack
      </button>
    </div>
  );
}

function createArcDemoCardAdapter(): WindowContentAdapter {
  return {
    id: 'arc-agi-player.demo-card-window',
    canRender: (window) => window.content.kind === 'surface' && window.content.surface?.bundleId === ARC_DEMO_STACK.id,
    render: (window) => {
      if (window.content.kind !== 'surface' || !window.content.surface || window.content.surface.bundleId !== ARC_DEMO_STACK.id) {
        return null;
      }

      return (
        <>
          <ArcPendingIntentEffectHost />
          <RuntimeSurfaceSessionHost
            windowId={window.id}
            sessionId={window.content.surface.surfaceSessionId}
            bundle={ARC_DEMO_STACK}
          />
        </>
      );
    },
  };
}

function createArcPlayerAdapter(openWindow: (payload: OpenWindowPayload) => void): WindowContentAdapter {
  return {
    id: 'arc-agi-player.windows',
    canRender: (window) => {
      if (window.content.kind !== 'app') return false;
      const key = window.content.appKey ?? '';
      return key.startsWith('arc-agi-player:');
    },
    render: (window) => {
      const key = window.content.appKey ?? '';
      if (key === APP_KEY_FOLDER) {
        return (
          <ArcPlayerHost>
            <ArcLauncherFolderWindow
              onOpenReactGame={() => openWindow(buildMainWindowPayload('command'))}
              onOpenCards={() => openWindow(buildDemoCardWindowPayload('command'))}
            />
          </ArcPlayerHost>
        );
      }

      if (key === APP_KEY_MAIN) {
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

      return null;
    },
  };
}

function ArcPlayerHost({ children }: { children: ReactNode }) {
  const storeRef = useRef<ReturnType<typeof createArcPlayerStore> | null>(null);
  if (!storeRef.current) {
    storeRef.current = createArcPlayerStore();
  }
  return <Provider store={storeRef.current}>{children}</Provider>;
}

export const arcPlayerLauncherModule: LaunchableAppModule = {
  manifest: {
    id: 'arc-agi-player',
    name: 'ARC-AGI',
    icon: '🎮',
    launch: { mode: 'window' },
    desktop: { order: 80 },
  },

  buildLaunchWindow: (_ctx, reason) => buildFolderWindowPayload(reason),

  createContributions: (hostContext): DesktopContribution[] => [
    {
      id: 'arc-agi-player.window-adapters',
      windowContentAdapters: [createArcDemoCardAdapter(), createArcPlayerAdapter(hostContext.openWindow)],
    },
  ],

  renderWindow: ({ windowId }): ReactNode => (
    <ArcPlayerHost key={windowId}>
      <ArcLauncherFolderWindow />
    </ArcPlayerHost>
  ),
};
