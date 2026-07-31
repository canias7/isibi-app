import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { WeatherContingency } from "@/components/charts/lib/events"
let s = 63
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const history = Array.from({ length: 30 }, (_, i) => ({
  year: 1996 + i,
  rainfallMm: Math.round(Math.pow(rnd(), 2.6) * 46 * 10) / 10,
}))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weather cover</CardTitle>
        <CardDescription>Probability from the record, not from a feeling</CardDescription>
      </CardHeader>
      <CardContent>
        <WeatherContingency
          history={history}
          attendance={4200}
          spendPerHead={58}
          refundThresholdMm={20}
          premium={26000}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The premium sits below the expected loss <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Outdoor date
        </div>
      </CardFooter>
    </Card>
  )
}
