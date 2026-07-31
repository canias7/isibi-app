import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { KerningPairs } from "@/components/charts/lib/typography"
const pairs = [
  { pair: "AV", defaultEm: 0, kernedEm: -0.062 },
  { pair: "To", defaultEm: 0, kernedEm: -0.084 },
  { pair: "Yo", defaultEm: 0, kernedEm: -0.071 },
  { pair: "LT", defaultEm: 0, kernedEm: -0.055 },
  { pair: "rn", defaultEm: 0, kernedEm: 0.018 },
  { pair: "F,", defaultEm: 0, kernedEm: -0.096 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kerning</CardTitle>
        <CardDescription>The correction each pair actually needs</CardDescription>
      </CardHeader>
      <CardContent>
        <KerningPairs pairs={pairs} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Invisible at 12px, glaring at 44 <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Six pairs
        </div>
      </CardFooter>
    </Card>
  )
}
