import assert from "node:assert/strict";
import test from "node:test";

import { copyTextToClipboard } from "./clipboard.ts";

type MockOptions = {
  secureContext?: boolean;
  writeText?: (text: string) => Promise<void>;
  execCommandResult?: boolean | (() => boolean);
  restoreFocusThrows?: boolean;
};

type MockBody = {
  appendChild: (element: MockTextarea) => void;
  removeChild: (element: MockTextarea) => void;
};

type MockTextarea = {
  value: string;
  style: Record<string, string>;
  parentNode: MockBody | null;
  setAttribute: () => void;
  focus: () => void;
  select: () => void;
  setSelectionRange: (start: number, end: number) => void;
};

function installClipboardMocks({
  secureContext = true,
  writeText,
  execCommandResult = true,
  restoreFocusThrows = false,
}: MockOptions = {}) {
  const originalDescriptors = new Map(
    ["window", "navigator", "document"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );

  let appended = false;
  let removed = false;
  let selected = false;
  let selectedRange: [number, number] | null = null;
  let copiedValue = "";
  let previousFocusRestored = false;

  const body: MockBody = {
    appendChild(element) {
      appended = true;
      element.parentNode = body;
    },
    removeChild(element) {
      removed = true;
      element.parentNode = null;
    },
  };
  const textarea: MockTextarea = {
    value: "",
    style: {} as Record<string, string>,
    parentNode: null as typeof body | null,
    setAttribute() {},
    focus() {},
    select() {
      selected = true;
    },
    setSelectionRange(start: number, end: number) {
      selectedRange = [start, end];
    },
  };
  const previousElement = {
    focus() {
      if (restoreFocusThrows) {
        throw new Error("focus blocked");
      }
      previousFocusRestored = true;
    },
  };
  const documentMock = {
    body,
    activeElement: previousElement,
    createElement(tagName: string) {
      assert.equal(tagName, "textarea");
      return textarea;
    },
    execCommand(command: string) {
      assert.equal(command, "copy");
      copiedValue = textarea.value;
      return typeof execCommandResult === "function"
        ? execCommandResult()
        : execCommandResult;
    },
  };

  Object.defineProperties(globalThis, {
    window: {
      configurable: true,
      writable: true,
      value: { isSecureContext: secureContext },
    },
    navigator: {
      configurable: true,
      writable: true,
      value: { clipboard: writeText ? { writeText } : undefined },
    },
    document: {
      configurable: true,
      writable: true,
      value: documentMock,
    },
  });

  return {
    state: () => ({
      appended,
      copiedValue,
      previousFocusRestored,
      removed,
      selected,
      selectedRange,
    }),
    restore() {
      for (const [name, descriptor] of originalDescriptors) {
        if (descriptor) {
          Object.defineProperty(globalThis, name, descriptor);
        } else {
          delete (globalThis as unknown as Record<string, unknown>)[name];
        }
      }
    },
  };
}

test("동기 복사가 지원되지 않으면 보안 컨텍스트의 Clipboard API를 사용한다", async () => {
  const writes: string[] = [];
  const mocks = installClipboardMocks({
    execCommandResult: false,
    writeText: async (text) => {
      writes.push(text);
    },
  });

  try {
    assert.equal(await copyTextToClipboard("한글\nSQL"), true);
    assert.deepEqual(writes, ["한글\nSQL"]);
    assert.equal(mocks.state().appended, true);
  } finally {
    mocks.restore();
  }
});

test("HTTP 또는 Clipboard API 미지원 환경에서는 textarea 방식으로 복사한다", async () => {
  const mocks = installClipboardMocks({ secureContext: false });

  try {
    assert.equal(await copyTextToClipboard("SELECT *\nFROM customer"), true);
    assert.deepEqual(mocks.state(), {
      appended: true,
      copiedValue: "SELECT *\nFROM customer",
      previousFocusRestored: true,
      removed: true,
      selected: true,
      selectedRange: [0, 22],
    });
  } finally {
    mocks.restore();
  }
});

test("동기 복사는 사용자 클릭 권한이 사라지기 전에 실행한다", async () => {
  let hasUserGesture = true;
  let asyncWriteCalled = false;
  const mocks = installClipboardMocks({
    execCommandResult: () => hasUserGesture,
    writeText: async () => {
      asyncWriteCalled = true;
      throw new Error("NotAllowedError");
    },
  });

  try {
    const copying = copyTextToClipboard("fallback");
    hasUserGesture = false;

    assert.equal(await copying, true);
    assert.equal(asyncWriteCalled, false);
    assert.equal(mocks.state().copiedValue, "fallback");
    assert.equal(mocks.state().removed, true);
  } finally {
    mocks.restore();
  }
});

test("Clipboard API 거부를 예외로 노출하지 않고 실패로 반환한다", async () => {
  const mocks = installClipboardMocks({
    execCommandResult: false,
    writeText: async () => {
      throw new Error("NotAllowedError");
    },
  });

  try {
    assert.equal(await copyTextToClipboard("denied"), false);
  } finally {
    mocks.restore();
  }
});

test("포커스 복원 실패가 성공한 복사 결과를 바꾸지 않는다", async () => {
  const mocks = installClipboardMocks({ restoreFocusThrows: true });

  try {
    assert.equal(await copyTextToClipboard("copied"), true);
    assert.equal(mocks.state().removed, true);
  } finally {
    mocks.restore();
  }
});

test("모든 복사 방식이 막히면 실패를 반환하고 임시 요소를 정리한다", async () => {
  const mocks = installClipboardMocks({
    secureContext: false,
    execCommandResult: false,
  });

  try {
    assert.equal(await copyTextToClipboard("blocked"), false);
    assert.equal(mocks.state().removed, true);
  } finally {
    mocks.restore();
  }
});
