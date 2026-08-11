import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PlaceholderPage({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="mb-4 text-2xl font-semibold">{title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Bientôt disponible</CardTitle>
          <CardDescription>
            {description} (prévu en {phase}).
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
