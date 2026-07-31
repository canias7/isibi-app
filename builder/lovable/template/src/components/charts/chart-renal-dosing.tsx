import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RenalDosing } from "@/components/charts/lib/pharma"
const bands = [
  { fromCrCl: 60, fraction: 1, note: "No adjustment" },
  { fromCrCl: 30, fraction: 0.5, note: "Half dose" },
  { fromCrCl: 15, fraction: 0.25, note: "Quarter dose" },
  { fromCrCl: 0, fraction: 0.125, note: "Specialist advice" },
]
const patients = [
  { name: "Patient A", crCl: 96 }, { name: "Patient B", crCl: 58 },
  { name: "Patient C", crCl: 41 }, { name: "Patient D", crCl: 22 },
  { name: "Patient E", crCl: 12 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Renal dose adjustment</CardTitle>
        <CardDescription>The band each patient falls in, and the dose it implies</CardDescription>
      </CardHeader>
      <CardContent>
        <RenalDosing standardDoseMg={400} bands={bands} patients={patients} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The dose is computed, never transcribed <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          CrCl bands
        </div>
      </CardFooter>
    </Card>
  )
}
