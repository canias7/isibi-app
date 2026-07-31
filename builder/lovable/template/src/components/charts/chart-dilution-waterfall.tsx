import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DilutionWaterfall } from "@/components/charts/lib/finance2"
const rounds = [
  { name: "Founding", ownership: 0.5, valuation: 1_000_000 },
  { name: "Seed", ownership: 0.38, valuation: 6_000_000 },
  { name: "Series A", ownership: 0.27, valuation: 24_000_000 },
  { name: "Series B", ownership: 0.19, valuation: 82_000_000 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Founder stake</CardTitle>
        <CardDescription>Percentage falling, value rising</CardDescription>
      </CardHeader>
      <CardContent>
        <DilutionWaterfall rounds={rounds} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Either number alone tells half the story <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Seed to Series B
        </div>
      </CardFooter>
    </Card>
  )
}
