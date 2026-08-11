import { describe, expect, it } from "vitest";
import { TZDate } from "@date-fns/tz";

import {
  computeNextRun,
  isoDayOfWeek,
  isRuleDue,
  occurrenceKey,
} from "@/lib/automations/schedule";

describe("isoDayOfWeek", () => {
  it("compte du lundi (1) au dimanche (7)", () => {
    // 2026-08-10 est un lundi.
    expect(isoDayOfWeek(new Date("2026-08-10T12:00:00Z"))).toBe(1);
    expect(isoDayOfWeek(new Date("2026-08-14T12:00:00Z"))).toBe(5); // vendredi
    expect(isoDayOfWeek(new Date("2026-08-16T12:00:00Z"))).toBe(7); // dimanche
  });
});

describe("computeNextRun — ponctuel", () => {
  it("ne se rejoue jamais", () => {
    expect(
      computeNextRun({ frequency: "ponctuel", timeOfDay: "15:00" }, new Date())
    ).toBeNull();
  });
});

describe("computeNextRun — quotidien", () => {
  it("vise aujourd'hui si l'heure n'est pas passée", () => {
    const next = computeNextRun(
      { frequency: "quotidien", timeOfDay: "08:00" },
      new Date("2026-08-11T04:00:00Z") // 06 h à Paris
    );
    expect(next).not.toBeNull();
    expect(occurrenceKey(next!)).toBe("2026-08-11T08:00");
  });

  it("passe à demain si l'heure est dépassée", () => {
    const next = computeNextRun(
      { frequency: "quotidien", timeOfDay: "08:00" },
      new Date("2026-08-11T12:00:00Z") // 14 h à Paris
    );
    expect(occurrenceKey(next!)).toBe("2026-08-12T08:00");
  });

  it("ne renvoie jamais une occurrence dans le passé", () => {
    const now = new Date("2026-08-11T12:00:00Z");
    const next = computeNextRun(
      { frequency: "quotidien", timeOfDay: "08:00" },
      now
    );
    expect(next!.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe("computeNextRun — hebdomadaire", () => {
  it("trouve le prochain vendredi 15 h", () => {
    // Mardi 11 août 2026, 10 h à Paris.
    const next = computeNextRun(
      { frequency: "hebdomadaire", timeOfDay: "15:00", dayOfWeek: 5 },
      new Date("2026-08-11T08:00:00Z")
    );
    expect(occurrenceKey(next!)).toBe("2026-08-14T15:00");
    expect(isoDayOfWeek(new TZDate(next!, "Europe/Paris"))).toBe(5);
  });

  it("passe à la semaine suivante si le jour est déjà passé", () => {
    // Samedi 15 août : le prochain vendredi est le 21.
    const next = computeNextRun(
      { frequency: "hebdomadaire", timeOfDay: "15:00", dayOfWeek: 5 },
      new Date("2026-08-15T10:00:00Z")
    );
    expect(occurrenceKey(next!)).toBe("2026-08-21T15:00");
  });

  it("passe à la semaine suivante si l'heure du jour même est dépassée", () => {
    // Vendredi 14 août, 16 h à Paris : trop tard pour 15 h.
    const next = computeNextRun(
      { frequency: "hebdomadaire", timeOfDay: "15:00", dayOfWeek: 5 },
      new Date("2026-08-14T14:00:00Z")
    );
    expect(occurrenceKey(next!)).toBe("2026-08-21T15:00");
  });

  it("garde le même vendredi si l'heure n'est pas encore atteinte", () => {
    // Vendredi 14 août, 9 h à Paris.
    const next = computeNextRun(
      { frequency: "hebdomadaire", timeOfDay: "15:00", dayOfWeek: 5 },
      new Date("2026-08-14T07:00:00Z")
    );
    expect(occurrenceKey(next!)).toBe("2026-08-14T15:00");
  });
});

describe("computeNextRun — mensuel", () => {
  it("vise le jour demandé du mois courant", () => {
    const next = computeNextRun(
      { frequency: "mensuel", timeOfDay: "09:00", dayOfMonth: 15 },
      new Date("2026-08-11T08:00:00Z")
    );
    expect(occurrenceKey(next!)).toBe("2026-08-15T09:00");
  });

  it("passe au mois suivant si le jour est passé", () => {
    const next = computeNextRun(
      { frequency: "mensuel", timeOfDay: "09:00", dayOfMonth: 5 },
      new Date("2026-08-11T08:00:00Z")
    );
    expect(occurrenceKey(next!)).toBe("2026-09-05T09:00");
  });

  it("ramène le 31 au dernier jour d'un mois plus court", () => {
    // Février 2027 compte 28 jours.
    const next = computeNextRun(
      { frequency: "mensuel", timeOfDay: "09:00", dayOfMonth: 31 },
      new Date("2027-02-01T08:00:00Z")
    );
    expect(occurrenceKey(next!)).toBe("2027-02-28T09:00");
  });
});

describe("changement d'heure — l'heure locale ne bouge pas", () => {
  it("garde 08 h avant et après le passage à l'heure d'hiver", () => {
    // En France, l'heure d'hiver arrive le dernier dimanche d'octobre.
    const avant = computeNextRun(
      { frequency: "quotidien", timeOfDay: "08:00" },
      new Date("2026-10-24T12:00:00Z")
    );
    const apres = computeNextRun(
      { frequency: "quotidien", timeOfDay: "08:00" },
      new Date("2026-11-02T12:00:00Z")
    );
    expect(occurrenceKey(avant!)).toContain("T08:00");
    expect(occurrenceKey(apres!)).toContain("T08:00");
  });
});

describe("occurrenceKey — socle de l'idempotence", () => {
  it("produit la même clé pour le même instant", () => {
    const instant = new Date("2026-08-14T13:00:00Z");
    expect(occurrenceKey(instant)).toBe(occurrenceKey(instant));
  });

  it("produit des clés différentes pour des occurrences différentes", () => {
    expect(occurrenceKey(new Date("2026-08-14T13:00:00Z"))).not.toBe(
      occurrenceKey(new Date("2026-08-21T13:00:00Z"))
    );
  });

  it("exprime la clé en heure locale, pas en UTC", () => {
    // 13 h UTC = 15 h à Paris en été.
    expect(occurrenceKey(new Date("2026-08-14T13:00:00Z"))).toBe(
      "2026-08-14T15:00"
    );
  });
});

describe("isRuleDue — tolérance au retard du planificateur", () => {
  const rule = { frequency: "quotidien" as const, timeOfDay: "08:00" };

  it("déclenche à l'heure prévue", () => {
    const result = isRuleDue(rule, new Date("2026-08-11T06:00:00Z")); // 08 h Paris
    expect(result.due).toBe(true);
    expect(occurrenceKey(result.scheduledAt!)).toBe("2026-08-11T08:00");
  });

  it("rattrape un déclenchement en retard de quelques minutes", () => {
    // 08 h 07 à Paris : le planificateur avait 7 minutes de retard.
    const result = isRuleDue(rule, new Date("2026-08-11T06:07:00Z"));
    expect(result.due).toBe(true);
    expect(occurrenceKey(result.scheduledAt!)).toBe("2026-08-11T08:00");
  });

  it("ne rejoue pas une occurrence trop ancienne", () => {
    // 11 h à Paris : bien au-delà de la tolérance.
    const result = isRuleDue(rule, new Date("2026-08-11T09:00:00Z"));
    expect(result.due).toBe(false);
    expect(result.scheduledAt).toBeNull();
  });

  it("ne déclenche pas avant l'heure", () => {
    const result = isRuleDue(rule, new Date("2026-08-11T05:00:00Z")); // 07 h Paris
    expect(result.due).toBe(false);
  });

  it("donne la même clé à chaque passage dans la fenêtre — idempotence", () => {
    const a = isRuleDue(rule, new Date("2026-08-11T06:01:00Z"));
    const b = isRuleDue(rule, new Date("2026-08-11T06:06:00Z"));
    expect(a.due && b.due).toBe(true);
    expect(occurrenceKey(a.scheduledAt!)).toBe(occurrenceKey(b.scheduledAt!));
  });
});

describe("scénario 2 de l'audit — « rappelle-moi vendredi à 15 h »", () => {
  it("planifie bien le vendredi 14 août à 15 h", () => {
    const next = computeNextRun(
      { frequency: "ponctuel", timeOfDay: "15:00" },
      new Date("2026-08-11T08:00:00Z")
    );
    // Un ponctuel n'a pas de récurrence : la date exacte est calculée par
    // l'IA puis stockée telle quelle. On vérifie ici la règle hebdomadaire
    // équivalente, qui sert au cas « chaque vendredi ».
    expect(next).toBeNull();

    const recurrent = computeNextRun(
      { frequency: "hebdomadaire", timeOfDay: "15:00", dayOfWeek: 5 },
      new Date("2026-08-11T08:00:00Z")
    );
    expect(occurrenceKey(recurrent!)).toBe("2026-08-14T15:00");
  });
});

describe("scénario 3 de l'audit — « chaque vendredi prépare le rapport »", () => {
  it("planifie une occurrence par semaine, sans doublon", () => {
    const spec = {
      frequency: "hebdomadaire" as const,
      timeOfDay: "18:00",
      dayOfWeek: 5,
    };
    const premier = computeNextRun(spec, new Date("2026-08-11T08:00:00Z"));
    const suivant = computeNextRun(spec, premier!);

    expect(occurrenceKey(premier!)).toBe("2026-08-14T18:00");
    expect(occurrenceKey(suivant!)).toBe("2026-08-21T18:00");
    expect(occurrenceKey(premier!)).not.toBe(occurrenceKey(suivant!));
  });
});
