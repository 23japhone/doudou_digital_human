import { describe, expect, test } from "vitest";
import {
  DOUDOU_TRAY_EMOTION_MENU_LABEL,
  DOUDOU_TRAY_EMOTION_REQUEST_TEXT,
  createDoudouRuntimeTrayMenuTemplate,
  createDoudouTrayEmotionBehaviorRequest,
  hasDoudouRuntimeTrayEmotionMenuItem,
  resolveDoudouTrayEmotionSmokeConsent
} from "../../src/runtime/default-doudou-emotion-tray.js";

describe("default doudou emotion tray menu", () => {
  test("creates a formal tray menu item with one-click authorization semantics", () => {
    let requested = false;
    const template = createDoudouRuntimeTrayMenuTemplate({
      onQuit: () => undefined,
      onRequestEmotion: () => {
        requested = true;
      }
    });

    expect(hasDoudouRuntimeTrayEmotionMenuItem(template)).toBe(true);
    const item = template.find((candidate) => candidate.label === DOUDOU_TRAY_EMOTION_MENU_LABEL);
    expect(item).toBeTruthy();
    expect(item?.label).toBe("让兜兜回应（本次授权）");

    item?.click?.();
    expect(requested).toBe(true);
  });

  test("creates a sanitized tray emotion request without debug fields", () => {
    expect(createDoudouTrayEmotionBehaviorRequest()).toEqual({
      consent: true,
      text: DOUDOU_TRAY_EMOTION_REQUEST_TEXT
    });
    expect(DOUDOU_TRAY_EMOTION_REQUEST_TEXT).toContain("托盘菜单");
    expect(DOUDOU_TRAY_EMOTION_REQUEST_TEXT).not.toContain("调试");
    expect(DOUDOU_TRAY_EMOTION_REQUEST_TEXT).not.toContain("模型");
    expect(DOUDOU_TRAY_EMOTION_REQUEST_TEXT).not.toContain("命令");
  });

  test("enables consented tray smoke only from explicit opt-in env", () => {
    expect(resolveDoudouTrayEmotionSmokeConsent({})).toBe(false);
    expect(resolveDoudouTrayEmotionSmokeConsent({
      DOUDOU_EMOTION_TRAY_SMOKE_CONSENT: "1"
    })).toBe(true);
    expect(resolveDoudouTrayEmotionSmokeConsent({
      DOUDOU_EMOTION_PANEL_SMOKE_CONSENT: "1"
    })).toBe(true);
    expect(resolveDoudouTrayEmotionSmokeConsent({
      DOUDOU_EMOTION_TRAY_SMOKE_CONSENT: "true"
    })).toBe(false);
  });
});
