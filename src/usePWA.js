/**
 * usePWA — PWA install prompt + splash management
 * Drop-in hook, no logic changes to existing code
 *
 * Usage in main.jsx or App.jsx:
 *   import { hideSplash } from "./usePWA.js";
 *   // call hideSplash() after your app is ready to show
 */

import { useState, useEffect, useCallback } from "react";

// ── Hide splash screen ──────────────────────────────────
export function hideSplash() {
  if (typeof window !== "undefined" && window.__hideSplash) {
    window.__hideSplash();
  }
}

// ── PWA Install Prompt Hook ─────────────────────────────
/**
 * Returns:
 *   canInstall  — true when browser has a deferred install prompt
 *   isInstalled — true when running as standalone PWA
 *   promptInstall — call this to trigger the native install dialog
 *   isIOS       — true on iOS (needs manual Safari instruction)
 */
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  const isIOS = /iphone|ipad|ipod/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent : ""
  );

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    if (standalone) {
      setIsInstalled(true);
      return;
    }

    function onBeforeInstall(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    function onInstalled() {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome === "accepted";
  }, [deferredPrompt]);

  return {
    canInstall: !!deferredPrompt && !isInstalled,
    isInstalled,
    isIOS,
    promptInstall,
  };
}

// ── Service Worker Update Notifier ─────────────────────
/**
 * Returns { updateAvailable, applyUpdate }
 * Show a toast when a new SW version is waiting
 */
export function useSWUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg) return;

      // Already waiting
      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
        setUpdateAvailable(true);
      }

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setUpdateAvailable(true);
          }
        });
      });
    });

    // Reload when new SW takes control
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
  }, [waitingWorker]);

  return { updateAvailable, applyUpdate };
}

