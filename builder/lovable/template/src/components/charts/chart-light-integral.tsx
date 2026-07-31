import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LightIntegral } from "@/components/charts/lib/horticulture"
const ppfd = Array.from({ length: 24 }, (_, h) => {
  if (h < 6 || h > 19) return 0
  const noon = 1 - Math.pow((h - 12.5) / 6.5, 2)
  const cloud = h === 11 || h === 12 ? 0.42 : 1
  return Math.max(0, 620 * noon * cloud)
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily light integral</CardTitle>
        <CardDescription>Integrated from the trace, not stated</CardDescription>
      </CardHeader>
      <CardContent>
        <LightIntegral ppfd={ppfd} cropTarget={17} supplementalPpfd={180} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Half an hour of supplement closes the gap <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          March, glasshouse
        </div>
      </CardFooter>
    </Card>
  )
}
