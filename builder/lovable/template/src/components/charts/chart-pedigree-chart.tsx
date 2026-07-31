import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PedigreeChart } from "@/components/charts/lib/med2"
const people = [
  { id: "I-1", sex: "m" as const, carrier: true, generation: 0, order: 0 },
  { id: "I-2", sex: "f" as const, carrier: true, generation: 0, order: 1 },
  { id: "II-1", sex: "f" as const, generation: 1, order: 0, parents: ["I-1", "I-2"] as [string, string] },
  { id: "II-2", sex: "m" as const, affected: true, generation: 1, order: 1, parents: ["I-1", "I-2"] as [string, string] },
  { id: "II-3", sex: "m" as const, carrier: true, generation: 1, order: 2, parents: ["I-1", "I-2"] as [string, string] },
  // Married in, so the mating line is between NEIGHBOURS and does not cross a sibling.
  { id: "II-4", sex: "f" as const, carrier: true, generation: 1, order: 3 },
  { id: "III-1", sex: "f" as const, affected: true, proband: true, generation: 2, order: 2, parents: ["II-3", "II-4"] as [string, string] },
  { id: "III-2", sex: "u" as const, generation: 2, order: 3, parents: ["II-3", "II-4"] as [string, string] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Family history</CardTitle>
        <CardDescription>Genetics notation</CardDescription>
      </CardHeader>
      <CardContent>
        <PedigreeChart people={people} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Shape is sex, fill is status <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Autosomal recessive
        </div>
      </CardFooter>
    </Card>
  )
}
