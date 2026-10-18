/**
 * The handful of WebExtension APIs the app's bridge touches.
 *
 * Declared here rather than pulling in @types/chrome: the app makes a handful
 * of calls, and the full typings would put every extension API in scope for a
 * codebase that is a website first. Chrome, Edge and Firefox all answer to `chrome.*`
 * with promise-returning methods under Manifest V3.
 */
declare namespace chrome {
  namespace storage {
    interface StorageArea {
      get(key: string): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(key: string): Promise<void>;
    }
    const local: StorageArea;
  }

  namespace tabs {
    interface Tab {
      id?: number;
      windowId: number;
    }
    function getCurrent(): Promise<Tab | undefined>;
    function update(tabId: number, properties: { active: boolean }): Promise<Tab>;
  }

  namespace windows {
    function update(windowId: number, properties: { focused: boolean }): Promise<unknown>;
  }

  namespace runtime {
    const id: string | undefined;
    const onMessage: {
      addListener(callback: (message: unknown) => void): void;
    };
  }
}
