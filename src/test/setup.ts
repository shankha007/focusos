import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * Everything jsdom does not implement that the app reaches for on the paths
 * under test. Each stub is the smallest thing that keeps the code under test
 * honest: none of them fake a result a test then asserts on.
 */

// The settings store subscribes to the OS colour scheme the moment it loads.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => false,
  }),
});

// The ambient engine builds a real audio graph on the first chime or soundscape.
// Web Audio has no jsdom implementation at all, so the graph is stubbed down to
// the handful of calls the engine makes on the session-completion path.
class StubAudioContext {
  currentTime = 0;
  destination = {} as AudioNode;
  state: AudioContextState = "running";
  sampleRate = 44100;

  private param() {
    return {
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
    };
  }

  private node() {
    const node = {
      connect: vi.fn(() => node),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      gain: this.param(),
      frequency: this.param(),
      Q: { value: 0 },
      type: "sine",
      buffer: null as AudioBuffer | null,
      loop: false,
    };
    return node;
  }

  createGain() { return this.node(); }
  createOscillator() { return this.node(); }
  createBiquadFilter() { return this.node(); }
  createBufferSource() { return this.node(); }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) } as unknown as AudioBuffer;
  }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}
vi.stubGlobal("AudioContext", StubAudioContext);

// jsdom's crypto has no randomUUID. Node's does, and it is the same API the
// browser exposes, so hand the real implementation through rather than
// inventing ids — collisions would show up as baffling test failures.
if (!globalThis.crypto?.randomUUID) {
  const { webcrypto } = await import("node:crypto");
  vi.stubGlobal("crypto", webcrypto);
}

afterEach(() => {
  cleanup();
});
