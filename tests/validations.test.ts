import { describe, expect, it } from "vitest";

import { companySchema } from "@/lib/validations/companies";
import { taskSchema } from "@/lib/validations/tasks";
import { timeEntrySchema } from "@/lib/validations/time-entries";

const COMPANY_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";

describe("companySchema", () => {
  it("accepte un nom seul et applique les défauts", () => {
    const result = companySchema.parse({ name: "Trust Industrie" });
    expect(result.name).toBe("Trust Industrie");
    expect(result.color).toBe("#FFA000");
  });

  it("refuse un nom vide", () => {
    expect(companySchema.safeParse({ name: "  " }).success).toBe(false);
  });

  it("transforme les champs vides en null", () => {
    const result = companySchema.parse({
      name: "X",
      contact_email: "",
      website: "",
      monthly_amount: "",
    });
    expect(result.contact_email).toBeNull();
    expect(result.website).toBeNull();
    expect(result.monthly_amount).toBeNull();
  });

  it("refuse un email ou une URL invalides", () => {
    expect(
      companySchema.safeParse({ name: "X", contact_email: "pas-un-email" })
        .success
    ).toBe(false);
    expect(
      companySchema.safeParse({ name: "X", website: "exemple" }).success
    ).toBe(false);
  });

  it("convertit le montant mensuel en nombre", () => {
    const result = companySchema.parse({ name: "X", monthly_amount: "450" });
    expect(result.monthly_amount).toBe(450);
  });
});

describe("taskSchema", () => {
  it("exige une entreprise et un titre", () => {
    expect(taskSchema.safeParse({ title: "Sans entreprise" }).success).toBe(
      false
    );
    expect(
      taskSchema.safeParse({ company_id: COMPANY_ID, title: "" }).success
    ).toBe(false);
  });

  it("applique les défauts métier", () => {
    const result = taskSchema.parse({
      company_id: COMPANY_ID,
      title: "Optimiser la fiche Bureau Alcôve",
    });
    expect(result.status).toBe("a_faire");
    expect(result.priority).toBe("normale");
    expect(result.billing_status).toBe("incluse");
    expect(result.project_id ?? null).toBeNull();
  });

  it("refuse un statut inconnu et une date invalide", () => {
    expect(
      taskSchema.safeParse({
        company_id: COMPANY_ID,
        title: "X",
        status: "fini",
      }).success
    ).toBe(false);
    expect(
      taskSchema.safeParse({
        company_id: COMPANY_ID,
        title: "X",
        due_date: "vendredi",
      }).success
    ).toBe(false);
  });

  it("accepte une échéance ISO et une estimation numérique", () => {
    const result = taskSchema.parse({
      company_id: COMPANY_ID,
      title: "X",
      due_date: "2026-08-14",
      estimated_minutes: "90",
    });
    expect(result.due_date).toBe("2026-08-14");
    expect(result.estimated_minutes).toBe(90);
  });
});

describe("timeEntrySchema", () => {
  it("refuse une durée nulle, négative ou géante", () => {
    const base = { company_id: COMPANY_ID, entry_date: "2026-08-11" };
    expect(timeEntrySchema.safeParse({ ...base, minutes: 0 }).success).toBe(
      false
    );
    expect(timeEntrySchema.safeParse({ ...base, minutes: -30 }).success).toBe(
      false
    );
    expect(
      timeEntrySchema.safeParse({ ...base, minutes: 5000 }).success
    ).toBe(false);
  });

  it("accepte une saisie complète", () => {
    const result = timeEntrySchema.parse({
      company_id: COMPANY_ID,
      task_id: "",
      minutes: "120",
      entry_date: "2026-08-11",
      description: "Trois fiches produits",
      is_billable: false,
    });
    expect(result.minutes).toBe(120);
    expect(result.task_id).toBeNull();
    expect(result.is_billable).toBe(false);
  });
});
