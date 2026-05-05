export interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: {
    user?: TelegramWebAppUser;
    auth_date?: number;
    hash?: string;
  };
  colorScheme?: "light" | "dark";
  themeParams?: TelegramThemeParams;
  isExpanded?: boolean;
  viewportHeight?: number;
  viewportStableHeight?: number;
  ready: () => void;
  expand: () => void;
  close: () => void;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  onEvent?: (eventType: string, eventHandler: () => void) => void;
  offEvent?: (eventType: string, eventHandler: () => void) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

const THEME_MAP: Array<[keyof TelegramThemeParams, string]> = [
  ["bg_color", "--tg-bg-color"],
  ["text_color", "--tg-text-color"],
  ["hint_color", "--tg-hint-color"],
  ["button_color", "--tg-button-color"],
  ["button_text_color", "--tg-button-text-color"],
  ["secondary_bg_color", "--tg-secondary-bg-color"],
  ["header_bg_color", "--tg-header-bg-color"],
  ["accent_text_color", "--tg-accent-text-color"],
];

export const getTelegramWebApp = () => window.Telegram?.WebApp;

export const getTelegramInitData = () => getTelegramWebApp()?.initData || "";

export const getTelegramUser = () => getTelegramWebApp()?.initDataUnsafe?.user || null;

export const isTelegramMiniApp = () => Boolean(getTelegramInitData() && getTelegramUser());

export const getTelegramDisplayName = (user: TelegramWebAppUser) => {
  if (user.username) return `@${user.username}`;
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || `Player_${user.id}`;
};

const syncViewport = (webApp: TelegramWebApp) => {
  const height = webApp.viewportStableHeight || webApp.viewportHeight;
  if (height) {
    document.documentElement.style.setProperty("--tg-viewport-height", `${height}px`);
  }
};

const syncTheme = (webApp: TelegramWebApp) => {
  document.documentElement.dataset.telegramTheme = webApp.colorScheme || "dark";

  THEME_MAP.forEach(([telegramKey, cssVar]) => {
    const value = webApp.themeParams?.[telegramKey];
    if (value) document.documentElement.style.setProperty(cssVar, value);
  });

  const bgColor = webApp.themeParams?.bg_color || "#050505";
  webApp.setHeaderColor?.(webApp.themeParams?.header_bg_color || bgColor);
  webApp.setBackgroundColor?.(bgColor);
};

export const initTelegramWebApp = () => {
  const webApp = getTelegramWebApp();
  if (!webApp) return () => undefined;

  webApp.ready();
  webApp.expand();
  webApp.enableClosingConfirmation?.();
  syncViewport(webApp);
  syncTheme(webApp);

  const handleViewportChange = () => syncViewport(webApp);
  const handleThemeChange = () => syncTheme(webApp);

  webApp.onEvent?.("viewportChanged", handleViewportChange);
  webApp.onEvent?.("themeChanged", handleThemeChange);

  return () => {
    webApp.offEvent?.("viewportChanged", handleViewportChange);
    webApp.offEvent?.("themeChanged", handleThemeChange);
  };
};
