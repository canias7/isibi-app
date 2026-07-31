import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Seriation } from "@/components/charts/lib/archaeology"
const types = ["Beaker", "Collared urn", "Food vessel", "Bucket urn", "Deverel-Rimbury"]
const assemblages = ["Pit 12", "Pit 3", "Ditch 7", "Barrow A", "Pit 21", "Ditch 2", "Barrow C", "Pit 9", "Ditch 14"]
const peak = [3.4, 0.6, 2.1, 1.2, 4.4, 2.9, 3.9, 1.8, 0.2]
const counts = peak.map((p) =>
  types.map((_, ti) => Math.max(0, Math.round(60 * Math.exp(-Math.pow(p - ti, 2) / 1.1))))
)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Seriation</CardTitle>
        <CardDescription>A battleship plot ordered by centre of gravity</CardDescription>
      </CardHeader>
      <CardContent>
        <Seriation assemblages={assemblages} types={types} counts={counts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The order is solved, not supplied <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Nine assemblages
        </div>
      </CardFooter>
    </Card>
  )
}
