import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { OxygenDip } from "@/components/charts/lib/aquaculture"
const readings = Array.from({ length: 97 }, (_, i) => {
  const minute = 1080 + i * 15
  const hour = (minute / 60) % 24
  // the trough sits before dawn, which is where it always is
  const diurnal = 7.4 - 2.6 * Math.exp(-Math.pow((hour - 5.2 + (hour > 18 ? 24 : 0)) / 3.4, 2))
  return { minute, mgL: Math.round(diurnal * 100) / 100 }
})
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dissolved oxygen</CardTitle>
        <CardDescription>Exposure is a duration, not a minimum</CardDescription>
      </CardHeader>
      <CardContent>
        <OxygenDip readings={readings} thresholdMgL={6} criticalMgL={5} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A daily minimum cannot tell a dip from four hours of it <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One night
        </div>
      </CardFooter>
    </Card>
  )
}
