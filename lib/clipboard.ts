type LegacyClipboardWindow = Window & {
  clipboardData?: {
    setData: (format: string, text: string) => boolean;
  };
};

function copyWithLegacyClipboardData(text: string): boolean {
  try {
    if (typeof window === "undefined") {
      return false;
    }

    const clipboardData = (window as LegacyClipboardWindow).clipboardData;
    if (!clipboardData || typeof clipboardData.setData !== "function") {
      return false;
    }

    return clipboardData.setData("Text", text);
  } catch {
    return false;
  }
}

function copyWithExecCommand(text: string): boolean {
  let textarea: HTMLTextAreaElement | null = null;
  let previouslyFocused: HTMLElement | null = null;

  try {
    if (
      typeof document === "undefined" ||
      !document.body ||
      typeof document.execCommand !== "function"
    ) {
      return false;
    }

    textarea = document.createElement("textarea");
    previouslyFocused = document.activeElement as HTMLElement | null;

    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.setAttribute("aria-hidden", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "-9999px";
    textarea.style.width = "1px";
    textarea.style.height = "1px";
    textarea.style.fontSize = "16px";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    try {
      if (textarea?.parentNode) {
        textarea.parentNode.removeChild(textarea);
      }
    } catch {
      // Cleanup must not turn a successful copy into a rejected operation.
    }
    try {
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus({ preventScroll: true });
      }
    } catch {
      try {
        if (previouslyFocused && typeof previouslyFocused.focus === "function") {
          previouslyFocused.focus();
        }
      } catch {
        // Focus restoration is best-effort in older embedded browsers.
      }
    }
  }
}

/**
 * Copies text while the click gesture is still active, then uses the modern API
 * when the synchronous browser APIs are unavailable.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    // Safari and embedded webviews can reject fallback copy after the first await.
    if (copyWithLegacyClipboardData(text) || copyWithExecCommand(text)) {
      return true;
    }

    if (
      typeof navigator !== "undefined" &&
      typeof window !== "undefined" &&
      window.isSecureContext !== false &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Capability getters and browser implementations can throw synchronously.
  }

  return false;
}
