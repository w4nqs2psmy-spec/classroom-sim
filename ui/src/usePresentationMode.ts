import { useCallback, useEffect, useState } from "react";

export interface PresentationModeApi {
  isPresenting: boolean;
  usingRealFullscreen: boolean;
  enter: () => void;
  exit: () => void;
}

/**
 * Wraps the real Fullscreen API, with feature detection and a graceful
 * fallback: requestFullscreen() is frequently blocked or rejected inside
 * iframed/embedded preview tooling (permissions-policy restrictions,
 * sandboxed iframes without allow="fullscreen") even when
 * document.fullscreenEnabled reports true — availability and actually
 * succeeding are different things, so `usingRealFullscreen` tracks
 * document.fullscreenElement directly rather than assuming success from
 * feature detection alone. When real fullscreen isn't actually engaged,
 * `isPresenting` still flips to true and the CSS-only `.simulated-fullscreen`
 * class (see styles.css) takes over instead. Escape always exits, whether or
 * not real fullscreen is in play.
 */
export function usePresentationMode(): PresentationModeApi {
  const [isPresenting, setIsPresenting] = useState(false);
  const [usingRealFullscreen, setUsingRealFullscreen] = useState(false);

  useEffect(() => {
    function onFullscreenChange() {
      setUsingRealFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const exit = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setIsPresenting(false);
  }, []);

  useEffect(() => {
    if (!isPresenting) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") exit();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPresenting, exit]);

  const enter = useCallback(() => {
    setIsPresenting(true);
    if (document.fullscreenEnabled) {
      document.documentElement.requestFullscreen().catch(() => {
        // Rejected (common in embedded/iframed contexts) — stay presenting,
        // just via the CSS-only fallback; usingRealFullscreen is already false.
      });
    }
  }, []);

  return { isPresenting, usingRealFullscreen, enter, exit };
}
