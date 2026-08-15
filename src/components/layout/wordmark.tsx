import { cn } from "@/lib/utils";

/**
 * Marque de l'application, signature comprise.
 *
 * Centralisée ici pour que « by Farouk » ne puisse pas manquer à un endroit :
 * tous les écrans affichent le même bloc.
 */
export const BRAND_NAME = "MAW Pilot";
export const BRAND_SIGNATURE = "by Farouk";
export const BRAND_FULL = `${BRAND_NAME} ${BRAND_SIGNATURE}`;

export function Wordmark({
  className,
  signatureClassName,
}: {
  className?: string;
  signatureClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      {BRAND_NAME}
      <span
        className={cn(
          "text-[0.7em] font-normal tracking-wide opacity-70",
          signatureClassName
        )}
      >
        {BRAND_SIGNATURE}
      </span>
    </span>
  );
}
