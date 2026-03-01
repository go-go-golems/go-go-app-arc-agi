export const ARC_DEMO_PLUGIN_BUNDLE = `
defineStackBundle(({ ui }) => {
  function asRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function domains(globalState) {
    return asRecord(asRecord(globalState).domains);
  }

  function arcBridgeDomain(globalState) {
    return asRecord(domains(globalState).arcBridge);
  }

  function arcSessionInfo(sessionState) {
    const state = asRecord(sessionState);
    const availableGames = asArray(state.arcAvailableGames)
      .map((value) => String(value || '').trim())
      .filter((value) => value.length > 0);
    return {
      status: String(state.arcStatus || 'idle'),
      requestId: String(state.arcLastRequestId || ''),
      sessionId: String(state.arcSessionId || ''),
      gameId: String(state.arcGameId || ''),
      lastError: String(state.arcLastError || ''),
      availableGames: Array.from(new Set(availableGames)),
    };
  }

  function latestCommand(globalState, requestId) {
    if (!requestId) {
      return {};
    }

    const commands = asRecord(asRecord(arcBridgeDomain(globalState).commands).byId);
    return asRecord(commands[requestId]);
  }

  function nextRequestId(prefix) {
    return prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
  }

  function notify(dispatchSystemCommand, message) {
    dispatchSystemCommand('notify', { message: String(message || '') });
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
    initialSessionState: {
      arcStatus: 'idle',
      arcLastRequestId: '',
      arcSessionId: '',
      arcGameId: '',
      arcLastError: '',
      arcAvailableGames: [],
    },
    cards: {
      home: {
        render({ sessionState, globalState }) {
          const info = arcSessionInfo(sessionState);
          const command = asRecord(latestCommand(globalState, info.requestId));
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
          setGameId({ dispatchSessionAction }, args) {
            const value = String(asRecord(args).value || '').trim();
            dispatchSessionAction('patch', { arcGameId: value });
          },

          quickGame({ dispatchSessionAction }, args) {
            const gameId = String(asRecord(args).gameId || '').trim();
            if (!gameId) {
              return;
            }
            dispatchSessionAction('patch', { arcGameId: gameId });
          },

          loadGames({ dispatchDomainAction, dispatchSessionAction }) {
            const requestId = nextRequestId('arc-list-games');
            dispatchSessionAction('patch', {
              arcStatus: 'requested',
              arcLastRequestId: requestId,
              arcLastError: '',
            });
            dispatchDomainAction('arc', 'command.request', {
              op: 'list-games',
              requestId,
              args: {},
            });
          },

          createSession({ dispatchDomainAction, dispatchSessionAction }) {
            const requestId = nextRequestId('arc-create-session');
            dispatchSessionAction('patch', {
              arcStatus: 'requested',
              arcLastRequestId: requestId,
              arcLastError: '',
            });
            dispatchDomainAction('arc', 'command.request', {
              op: 'create-session',
              requestId,
              args: {},
            });
          },

          resetGame({ dispatchDomainAction, dispatchSessionAction, dispatchSystemCommand, sessionState }) {
            const info = arcSessionInfo(sessionState);
            if (!info.sessionId) {
              notify(dispatchSystemCommand, 'Create a session first.');
              return;
            }
            if (!info.gameId) {
              notify(dispatchSystemCommand, 'Load Games, then choose a Game ID first.');
              return;
            }

            const requestId = nextRequestId('arc-reset-game');
            dispatchSessionAction('patch', {
              arcStatus: 'requested',
              arcLastRequestId: requestId,
              arcLastError: '',
            });
            dispatchDomainAction('arc', 'command.request', {
              op: 'reset-game',
              requestId,
              args: {
                sessionId: info.sessionId,
                gameId: info.gameId,
              },
            });
          },

          doAction({ dispatchDomainAction, dispatchSessionAction, dispatchSystemCommand, sessionState }, args) {
            const info = arcSessionInfo(sessionState);
            if (!info.sessionId) {
              notify(dispatchSystemCommand, 'Create a session first.');
              return;
            }
            if (!info.gameId) {
              notify(dispatchSystemCommand, 'Load Games, then choose a Game ID first.');
              return;
            }

            const action = canonicalAction(asRecord(args).action || 'up');
            const requestId = nextRequestId('arc-action');
            dispatchSessionAction('patch', {
              arcStatus: 'requested',
              arcLastRequestId: requestId,
              arcLastError: '',
            });
            dispatchDomainAction('arc', 'command.request', {
              op: 'perform-action',
              requestId,
              args: {
                sessionId: info.sessionId,
                gameId: info.gameId,
                action: { action },
              },
            });
          },

          loadTimeline({ dispatchDomainAction, dispatchSessionAction, dispatchSystemCommand, sessionState }) {
            const info = arcSessionInfo(sessionState);
            if (!info.sessionId) {
              notify(dispatchSystemCommand, 'Create a session first.');
              return;
            }

            const requestId = nextRequestId('arc-timeline');
            dispatchSessionAction('patch', {
              arcStatus: 'requested',
              arcLastRequestId: requestId,
              arcLastError: '',
            });
            dispatchDomainAction('arc', 'command.request', {
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
