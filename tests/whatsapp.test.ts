import { describe, expect, it } from "vitest";

import {
  buildWhatsAppLink,
  formatPhoneForDisplay,
  isValidInternationalNumber,
  normalizePhoneNumber,
} from "@/lib/whatsapp";
import { channelSchema, contactSchema } from "@/lib/validations/contacts";

const COMPANY_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";

describe("normalizePhoneNumber", () => {
  it("retire espaces, points et tirets en gardant le +", () => {
    expect(normalizePhoneNumber("+33 6 12 34 56 78")).toBe("+33612345678");
    expect(normalizePhoneNumber("+213-661-23-45-67")).toBe("+213661234567");
  });
});

describe("isValidInternationalNumber", () => {
  it("accepte un numéro international correct", () => {
    expect(isValidInternationalNumber("+33612345678")).toBe(true);
    expect(isValidInternationalNumber("+213661234567")).toBe(true);
    expect(isValidInternationalNumber("+1 202 555 0134")).toBe(true);
  });

  it("refuse un numéro national, vide ou mal formé", () => {
    expect(isValidInternationalNumber("0612345678")).toBe(false);
    expect(isValidInternationalNumber("+0612345678")).toBe(false);
    expect(isValidInternationalNumber("")).toBe(false);
    expect(isValidInternationalNumber("+33")).toBe(false);
    expect(isValidInternationalNumber("pas un numéro")).toBe(false);
  });
});

describe("buildWhatsAppLink", () => {
  it("produit un lien wa.me sans le +", () => {
    expect(buildWhatsAppLink("+33612345678")).toBe(
      "https://wa.me/33612345678"
    );
  });

  it("encode le message prérempli", () => {
    const link = buildWhatsAppLink("+33612345678", "Bonjour, voici le rapport");
    expect(link).toBe(
      "https://wa.me/33612345678?text=Bonjour%2C%20voici%20le%20rapport"
    );
  });

  it("refuse de fabriquer un lien pour un numéro invalide", () => {
    expect(buildWhatsAppLink("0612345678")).toBeNull();
    expect(buildWhatsAppLink("")).toBeNull();
  });

  it("est déterministe pour un même couple numéro/message", () => {
    const a = buildWhatsAppLink("+33612345678", "Rapport S32");
    const b = buildWhatsAppLink("+33 6 12 34 56 78", "Rapport S32");
    expect(a).toBe(b);
  });
});

describe("formatPhoneForDisplay", () => {
  it("renvoie l'entrée telle quelle si le numéro est invalide", () => {
    expect(formatPhoneForDisplay("0612345678")).toBe("0612345678");
  });
});

describe("contactSchema", () => {
  it("refuse un numéro WhatsApp national", () => {
    const result = contactSchema.safeParse({
      company_id: COMPANY_ID,
      name: "Karim",
      whatsapp_number: "0612345678",
    });
    expect(result.success).toBe(false);
  });

  it("normalise un numéro international valide", () => {
    const result = contactSchema.parse({
      company_id: COMPANY_ID,
      name: "Karim",
      whatsapp_number: "+33 6 12 34 56 78",
    });
    expect(result.whatsapp_number).toBe("+33612345678");
  });
});

describe("channelSchema", () => {
  it("exige un numéro pour un WhatsApp direct", () => {
    const result = channelSchema.safeParse({
      company_id: COMPANY_ID,
      type: "whatsapp_direct",
      label: "WhatsApp de Karim",
    });
    expect(result.success).toBe(false);
  });

  it("exige un nom de groupe pour un groupe WhatsApp", () => {
    const result = channelSchema.safeParse({
      company_id: COMPANY_ID,
      type: "whatsapp_groupe",
      label: "Groupe direction",
    });
    expect(result.success).toBe(false);
  });

  it("accepte un groupe correctement renseigné", () => {
    const result = channelSchema.safeParse({
      company_id: COMPANY_ID,
      type: "whatsapp_groupe",
      label: "Groupe direction",
      group_name: "Suivi SEO — Trust Industrie",
    });
    expect(result.success).toBe(true);
  });
});
