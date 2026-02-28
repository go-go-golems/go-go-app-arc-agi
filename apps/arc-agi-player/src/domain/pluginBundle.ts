export const ARC_DEMO_PLUGIN_BUNDLE = `
defineStackBundle(({ ui }) => {
  function asRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function domains(globalState) {
    return asRecord(asRecord(globalState).domains);
  }

  function arcBridgeDomain(globalState) {
    return asRecord(domains(globalState).arcBridge);
  }

  function arcSessionInfo(sessionState) {
    const state = asRecord(sessionState);
    return {
      status: String(state.arcStatus || 'idle'),
      requestId: String(state.arcLastRequestId || ''),
      sessionId: String(state.arcSessionId || ''),
      gameId: String(state.arcGameId || ''),
      lastError: String(state.arcLastError || ''),
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

  return {
    id: 'arc-agi-demo',
    title: 'ARC Demo Card',
    initialSessionState: {
      arcStatus: 'idle',
      arcLastRequestId: '',
      arcSessionId: '',
      arcGameId: 'bt11',
      arcLastError: '',
    },
    cards: {
      home: {
        render({ sessionState, globalState }) {
          const info = arcSessionInfo(sessionState);
          const command = asRecord(latestCommand(globalState, info.requestId));
          const commandStatus = String(command.status || info.status || 'idle');

          return ui.panel([
            ui.text('ARC-AGI HyperCard Demo'),
            ui.text('Status: ' + commandStatus),
            ui.text('Runtime requestId: ' + (info.requestId || '-')),
            ui.text('ARC sessionId: ' + (info.sessionId || '-')),
            ui.text('ARC gameId: ' + (info.gameId || '-')),
            ui.row([
              ui.text('Game ID:'),
              ui.input(info.gameId || '', { onChange: { handler: 'setGameId' } }),
            ]),
            ui.row([
              ui.button('bt11', { onClick: { handler: 'quickGame', args: { gameId: 'bt11' } } }),
              ui.button('vc33', { onClick: { handler: 'quickGame', args: { gameId: 'vc33' } } }),
              ui.button('ft09', { onClick: { handler: 'quickGame', args: { gameId: 'ft09' } } }),
              ui.button('ls20', { onClick: { handler: 'quickGame', args: { gameId: 'ls20' } } }),
            ]),
            info.lastError ? ui.text('Last error: ' + info.lastError) : ui.text('Last error: -'),
            ui.row([
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
              notify(dispatchSystemCommand, 'Set a Game ID first (e.g. bt11).');
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
              notify(dispatchSystemCommand, 'Set a Game ID first (e.g. bt11).');
              return;
            }

            const action = String(asRecord(args).action || 'up');
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
