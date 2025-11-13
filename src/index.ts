import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette, WidgetTracker } from '@jupyterlab/apputils';
import { IStateDB } from '@jupyterlab/statedb';
import { logDebug, logError, logInfo, logWarn } from './logging';
import type { TodoPanel } from './panel';

const PLUGIN_ID = 'jupyterlab-todo-list:plugin';
const OPEN_CMD = 'jlab-todo:open';
const TODO_STATE_KEY = 'jlab-todo-storage:items';

const AUTO_OPEN_TIMEOUT = 15000;

const plugin: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  description:
    'A JupyterLab side panel for to-dos with checkbox import from notebooks.',
  autoStart: true,
  requires: [ICommandPalette, ILayoutRestorer, IStateDB],
  activate: async (
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    restorer: ILayoutRestorer,
    state: IStateDB
  ) => {
    const { shell, commands } = app;
    const serverSettings = app.serviceManager.serverSettings;

    logInfo('JupyterLab extension jupyterlab-todo-list is activated!');
    logDebug('activate start - importing panel module');
    const panelModule = await import('./panel');
    const { todoIcon, TodoPanel } = panelModule;
    logDebug('imported panel module');

    const tracker = new WidgetTracker<TodoPanel>({
      namespace: 'jlab-todo'
    });

    let panel: TodoPanel | null = null;

    function ensurePanel(): TodoPanel {
      if (!panel || panel.isDisposed) {
        panel = new TodoPanel({
          state,
          storageKey: TODO_STATE_KEY,
          serverSettings
        });
        void tracker.add(panel);
      }
      return panel;
    }

    commands.addCommand(OPEN_CMD, {
      label: 'Open To-Do List',
      caption: 'Open the To-Do side panel',
      icon: todoIcon,
      execute: () => {
        const w = ensurePanel();
        if (!w.isAttached) {
          shell.add(w, 'left', { rank: 400 });
        }
        shell.activateById(w.id);
      }
    });

    try {
      logDebug('registering restorer');
      void restorer.restore(tracker, {
        command: OPEN_CMD,
        name: () => 'singleton'
      });
    } catch (err) {
      logError('restorer.restore failed', err);
    }

    palette.addItem({ command: OPEN_CMD, category: 'To-Do' });

    const runAutoOpen = async () => {
      logDebug('waiting for app.restored (with timeout)');

      try {
        // avoid blocking JupyterLab forever — diagnostic timeout
        await Promise.race([
          app.restored,
          new Promise<void>(resolve =>
            setTimeout(() => {
              logWarn(`app.restored timeout reached (${AUTO_OPEN_TIMEOUT}ms)`);
              resolve();
            }, AUTO_OPEN_TIMEOUT)
          )
        ]);
      } catch (err) {
        logError('error waiting for app.restored', err);
      }

      const w = ensurePanel();
      shell.add(w, 'left', { rank: 400 });
    };
    void runAutoOpen();
  }
};
export default plugin;
