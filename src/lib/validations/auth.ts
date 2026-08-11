import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string({ error: "L'email est requis." })
    .trim()
    .email("Adresse email invalide."),
  password: z
    .string({ error: "Le mot de passe est requis." })
    .min(1, "Le mot de passe est requis."),
});

export type LoginInput = z.infer<typeof loginSchema>;
