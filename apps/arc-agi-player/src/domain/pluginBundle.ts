export const ARC_DEMO_PLUGIN_BUNDLE = `
defineRuntimeBundle(({ ui }) => {
  function asRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function filtersState(state) {
    return asRecord(asRecord(state).filters);
  }

  function arcBridgeDomain(state) {
    return asRecord(asRecord(state).arcBridge);
  }

  function arcSessionInfo(state) {
    const filters = filtersState(state);
    const availableGames = asArray(filters.arcAvailableGames)
      .map((value) => String(value || '').trim())
      .filter((value) => value.length > 0);
    return {
      status: String(filters.arcStatus || 'idle'),
      requestId: String(filters.arcLastRequestId || ''),
      sessionId: String(filters.arcSessionId || ''),
      gameId: String(filters.arcGameId || ''),
      lastError: String(filters.arcLastError || ''),
      availableGames: Array.from(new Set(availableGames)),
    };
  }

  function latestCommand(state, requestId) {
    if (!requestId) {
      return {};
    }

    const commands = asRecord(asRecord(arcBridgeDomain(state).commands).byId);
    return asRecord(commands[requestId]);
  }

  function nextRequestId(prefix) {
    return prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
  }

  function notify(context, message) {
    context.dispatch({ type: 'notify.show', payload: { message: String(message || '') } });
  }

  function patchFilters(context, payload) {
    context.dispatch({ type: 'filters.patch', payload });
  }

  function dispatchArc(context, payload) {
    context.dispatch({ type: 'arc/command.request', payload });
  }

  function canonicalAction(raw) {
    const token = String(raw || '').trim().toLowerCase();
    if (token === 'up') return 'ACTION1';
    if (token === 'down') return 'ACTION2';
    if (token === 'left') return 'ACTION3';
    if (token === 'right') return 'ACTION4';
    if (/^action[1-7]$/i.test(token)) return token.toUpperCase();
    if (/^[1-7]$/.test(token)) return 'ACTION' + token;
    return token ? String(raw).trim() : 'ACTION1';
  }

  return {
    id: 'arc-agi-demo',
    title: 'ARC Demo Card',
    packageIds: ["ui"],
    initialSessionState: {
      arcStatus: 'idle',
      arcLastRequestId: '',
      arcSessionId: '',
      arcGameId: '',
      arcLastError: '',
      arcAvailableGames: [],
    },
    surfaces: {
      home: {
        render({ state }) {
          const info = arcSessionInfo(state);
          const command = asRecord(latestCommand(state, info.requestId));
          const commandStatus = String(command.status || info.status || 'idle');
          const gameButtons = info.availableGames
            .slice(0, 12)
            .map((gameId) => ui.button(gameId, { onClick: { handler: 'quickGame', args: { gameId } } }));

          return ui.panel([
            ui.text('ARC-AGI HyperCard Demo'),
            ui.text('Status: ' + commandStatus),
            ui.text('Runtime requestId: ' + (info.requestId || '-')),
            ui.text('ARC sessionId: ' + (info.sessionId || '-')),
            ui.text('ARC gameId: ' + (info.gameId || '-')),
            ui.text('Available games: ' + (info.availableGames.length ? info.availableGames.join(', ') : '-')),
            ui.row([
              ui.text('Game ID:'),
              ui.input(info.gameId || '', { onChange: { handler: 'setGameId' } }),
            ]),
            gameButtons.length ? ui.row(gameButtons) : ui.text('Use "Load Games" to discover valid game IDs.'),
            info.lastError ? ui.text('Last error: ' + info.lastError) : ui.text('Last error: -'),
            ui.row([
              ui.button('Load Games', { onClick: { handler: 'loadGames' } }),
              ui.button('Create Session', { onClick: { handler: 'createSession' } }),
              ui.button('Reset Game', { onClick: { handler: 'resetGame' } }),
              ui.button('Load Timeline', { onClick: { handler: 'loadTimeline' } }),
            ]),
            ui.row([
              ui.button('Up', { onClick: { handler: 'doAction', args: { action: 'up' } } }),
              ui.button('Down', { onClick: { handler: 'doAction', args: { action: 'down' } } }),
              ui.button('Left', { onClick: { handler: 'doAction', args: { action: 'left' } } }),
              ui.button('Right', { onClick: { handler: 'doAction', args: { action: 'right' } } }),
            ]),
          ]);
        },

        handlers: {
          setGameId(context, args) {
            const value = String(asRecord(args).value || '').trim();
            patchFilters(context, { arcGameId: value });
          },

          quickGame(context, args) {
            const gameId = String(asRecord(args).gameId || '').trim();
            if (!gameId) {
              return;
            }
            patchFilters(context, { arcGameId: gameId });
          },

          loadGames(context) {
            const requestId = nextRequestId('arc-list-games');
            patchFilters(context, {
              arcStatus: 'requested',
              arcLastRequestId: requestId,
              arcLastError: '',
            });
            dispatchArc(context, {
              op: 'list-games',
              requestId,
              args: {},
            });
          },

          createSession(context) {
            const requestId = nextRequestId('arc-create-session');
            patchFilters(context, {
              arcStatus: 'requested',
              arcLastRequestId: requestId,
              arcLastError: '',
            });
            dispatchArc(context, {
              op: 'create-session',
              requestId,
              args: {},
            });
          },

          resetGame(context) {
            const info = arcSessionInfo(context.state);
            if (!info.sessionId) {
              notify(context, 'Create a session first.');
              return;
            }
            if (!info.gameId) {
              notify(context, 'Load Games, then choose a Game ID first.');
              return;
            }

            const requestId = nextRequestId('arc-reset-game');
            patchFilters(context, {
              arcStatus: 'requested',
              arcLastRequestId: requestId,
              arcLastError: '',
            });
            dispatchArc(context, {
              op: 'reset-game',
              requestId,
              args: {
                sessionId: info.sessionId,
                gameId: info.gameId,
              },
            });
          },

          doAction(context, args) {
            const info = arcSessionInfo(context.state);
            if (!info.sessionId) {
              notify(context, 'Create a session first.');
              return;
            }
            if (!info.gameId) {
              notify(context, 'Load Games, then choose a Game ID first.');
              return;
            }

            const action = canonicalAction(asRecord(args).action || 'up');
            const requestId = nextRequestId('arc-action');
            patchFilters(context, {
              arcStatus: 'requested',
              arcLastRequestId: requestId,
              arcLastError: '',
            });
            dispatchArc(context, {
              op: 'perform-action',
              requestId,
              args: {
                sessionId: info.sessionId,
                gameId: info.gameId,
                action: { action },
              },
            });
          },

          loadTimeline(context) {
            const info = arcSessionInfo(context.state);
            if (!info.sessionId) {
              notify(context, 'Create a session first.');
              return;
            }

            const requestId = nextRequestId('arc-timeline');
            patchFilters(context, {
              arcStatus: 'requested',
              arcLastRequestId: requestId,
              arcLastError: '',
            });
            dispatchArc(context, {
              op: 'load-timeline',
              requestId,
              args: {
                sessionId: info.sessionId,
              },
            });
          },
        },
      },
    },
  };
});
`;
