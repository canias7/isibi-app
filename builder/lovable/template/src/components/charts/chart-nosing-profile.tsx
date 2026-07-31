import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { NosingProfile } from "@/components/charts/lib/spirits"
let s = 128
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const attributes = ["Fruit", "Malt", "Oak", "Peat", "Spice", "Sweetness", "Finish"]
const spread = [0.7, 0.5, 1.1, 2.6, 1.4, 0.6, 1.8]
const centre = [6.8, 5.4, 7.2, 3.1, 5.9, 6.2, 7.0]
const panels = ["Taster 1", "Taster 2", "Taster 3", "Taster 4", "Taster 5", "Taster 6", "Taster 7"].map((name) => ({
  name,
  scores: centre.map((c, i) => Math.round(Math.min(10, Math.max(0, c + (rnd() - 0.5) * spread[i] * 2.6)) * 10) / 10),
}))
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasting panel</CardTitle>
        <CardDescription>The spread, not just the mean</CardDescription>
      </CardHeader>
      <CardContent>
        <NosingProfile attributes={attributes} panels={panels} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A spider of means presents disagreement as consensus <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Seven tasters
        </div>
      </CardFooter>
    </Card>
  )
}
