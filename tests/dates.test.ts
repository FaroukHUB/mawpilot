import { describe, expect, it } from "vitest";

import {
  formatDateLong,
  formatDateShort,
  formatMinutes,
} from "@/lib/dates";

describe("formatMinutes", () => {
  it("affiche les minutes seules sous une heure", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(1)).toBe("1 min");
  });

  it("affiche les heures rondes sans minutes", () => {
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(120)).toBe("2 h");
  });

  it("affiche heures et minutes combinées", () => {
    expect(formatMinutes(150)).toBe("2 h 30");
    expect(formatMinutes(61)).toBe("1 h 01");
  });

  it("ne casse pas sur les valeurs limites", () => {
    expect(formatMinutes(0)).toBe("0 min");
    expect(formatMinutes(-10)).toBe("0 min");
    expect(formatMinutes(90.4)).toBe("1 h 30");
  });
});

describe("formats de dates françaises", () => {
  it("formate une date longue en français", () => {
    expect(formatDateLong("2026-08-11")).toBe("mardi 11 août 2026");
  });

  it("formate une date courte jj/mm/aaaa", () => {
    expect(formatDateShort("2026-08-11")).toBe("11/08/2026");
  });

  it("convertit un horodatage UTC vers Europe/Paris", () => {
    // 23h30 UTC le 10 août = 01h30 le 11 août à Paris (été, UTC+2).
    expect(formatDateShort("2026-08-10T23:30:00Z")).toBe("11/08/2026");
  });
});
