import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

let isExiting = false;

const performExit = async () => {
  if (isExiting) return;
  isExiting = true;

  const root = document.getElementById('splash-root');
  if (root) {
    root.classList.add('fade-out');
  }

  // Allow 160ms for smooth CSS fade-out transition before destroying splash window
  setTimeout(async () => {
    try {
      await invoke('close_splashscreen');
    } catch (e) {
      console.warn('Failed to invoke close_splashscreen:', e);
    }
  }, 160);
};

// 1. Single discrete wink if loading takes > 750ms
const blinkTimer = setTimeout(() => {
  if (isExiting) return;
  const blinkEl = document.getElementById('mascot-blink');
  if (blinkEl) {
    blinkEl.style.opacity = '1';
    setTimeout(() => {
      blinkEl.style.opacity = '0';
    }, 150);
  }
}, 750);

// 2. Listen for app-ready signal from main window
listen('app-ready', () => {
  clearTimeout(blinkTimer);
  performExit();
});

// 3. Safety Fallback: Never get stuck under any circumstances
const safetyFallback = setTimeout(() => {
  clearTimeout(blinkTimer);
  performExit();
}, 4500);

// Clean up if window closes
window.addEventListener('beforeunload', () => {
  clearTimeout(blinkTimer);
  clearTimeout(safetyFallback);
});
