import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DrugInteraction } from "@/components/charts/lib/pharma"
const drugs = ["Warfarin", "Amiodarone", "Simvastatin", "Clarithromycin", "Metformin", "Omeprazole"]
const interactions = [
  { a: "Warfarin", b: "Amiodarone", level: "major" as const, note: "INR rises for weeks — reduce and monitor" },
  { a: "Warfarin", b: "Clarithromycin", level: "major" as const, note: "CYP inhibition, bleeding risk" },
  { a: "Simvastatin", b: "Clarithromycin", level: "contraindicated" as const, note: "Rhabdomyolysis — do not co-prescribe" },
  { a: "Simvastatin", b: "Amiodarone", level: "moderate" as const, note: "Cap simvastatin at 20 mg" },
  { a: "Warfarin", b: "Omeprazole", level: "minor" as const },
  { a: "Metformin", b: "Omeprazole", level: "minor" as const },
  { a: "Amiodarone", b: "Clarithromycin", level: "major" as const, note: "QT prolongation" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Interaction grid</CardTitle>
        <CardDescription>Every pair on the list checked</CardDescription>
      </CardHeader>
      <CardContent>
        <DrugInteraction drugs={drugs} interactions={interactions} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Severity carries a glyph, never a shade alone <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Six-drug regimen
        </div>
      </CardFooter>
    </Card>
  )
}
