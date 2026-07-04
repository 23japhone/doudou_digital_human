import type { DoudouRuntimeEmotionBehaviorTriggerInput } from "./default-doudou-emotion-trigger.js";

export const DOUDOU_TRAY_EMOTION_MENU_LABEL = "让兜兜回应（本次授权）";
export const DOUDOU_TRAY_EMOTION_QUIT_LABEL = "退出兜兜";
export const DOUDOU_TRAY_EMOTION_REQUEST_TEXT =
  "我刚刚从托盘菜单点了兜兜回应，请给一个轻快但不打扰的表情反馈。";

export interface DoudouRuntimeTrayMenuItem {
  click?: () => void;
  label?: string;
  type?: "normal" | "separator";
}

export function createDoudouTrayEmotionBehaviorRequest(): DoudouRuntimeEmotionBehaviorTriggerInput {
  return {
    consent: true,
    text: DOUDOU_TRAY_EMOTION_REQUEST_TEXT
  };
}

export function resolveDoudouTrayEmotionSmokeConsent(
  env: Partial<Record<string, string | undefined>>
): boolean {
  return env.DOUDOU_EMOTION_TRAY_SMOKE_CONSENT === "1" || env.DOUDOU_EMOTION_PANEL_SMOKE_CONSENT === "1";
}

export function createDoudouRuntimeTrayMenuTemplate(input: {
  onQuit: () => void;
  onRequestEmotion: () => void;
}): DoudouRuntimeTrayMenuItem[] {
  return [
    {
      label: DOUDOU_TRAY_EMOTION_MENU_LABEL,
      click: input.onRequestEmotion
    },
    {
      type: "separator"
    },
    {
      label: DOUDOU_TRAY_EMOTION_QUIT_LABEL,
      click: input.onQuit
    }
  ];
}

export function hasDoudouRuntimeTrayEmotionMenuItem(template: readonly DoudouRuntimeTrayMenuItem[]): boolean {
  return template.some((item) => item.label === DOUDOU_TRAY_EMOTION_MENU_LABEL && typeof item.click === "function");
}
