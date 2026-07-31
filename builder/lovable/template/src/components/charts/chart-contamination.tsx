import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Contamination } from "@/components/charts/lib/waste"
const rounds = [
  { name: "Round 12 — flats", contaminationPercent: 7.8, tonnes: 11.4 },
  { name: "Round 4 — terraces", contaminationPercent: 5.4, tonnes: 14.2 },
  { name: "Round 9 — mixed", contaminationPercent: 4.6, tonnes: 12.8 },
  { name: "Round 1 — suburban", contaminationPercent: 2.1, tonnes: 16.9 },
  { name: "Round 7 — rural", contaminationPercent: 1.4, tonnes: 8.2 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contamination</CardTitle>
        <CardDescription>The rejection threshold is a cliff</CardDescription>
      </CardHeader>
      <CardContent>
        <Contamination
          rounds={rounds}
          rejectionThreshold={5}
          cleanValuePerT={96}
          disposalCostPerT={126}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One point over turns value into cost <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          5% threshold
        </div>
      </CardFooter>
    </Card>
  )
}
