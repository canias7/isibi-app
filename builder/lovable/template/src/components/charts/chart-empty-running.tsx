import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmptyRunning } from "@/components/charts/lib/freight"
const vehicles = [
  { name: "FH12 · trunk", loadedMiles: 2840, emptyMiles: 260, revenue: 4180 },
  { name: "XF14 · regional", loadedMiles: 1960, emptyMiles: 640, revenue: 3020 },
  { name: "FM09 · multidrop", loadedMiles: 820, emptyMiles: 190, revenue: 1740 },
  { name: "TGX02 · tramping", loadedMiles: 2410, emptyMiles: 880, revenue: 3260 },
  { name: "R450 · store deliveries", loadedMiles: 1420, emptyMiles: 1180, revenue: 2410 },
  { name: "Actros 6 · curtain", loadedMiles: 2100, emptyMiles: 420, revenue: 3480 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Empty running</CardTitle>
        <CardDescription>An empty mile costs the same and earns nothing</CardDescription>
      </CardHeader>
      <CardContent>
        <EmptyRunning vehicles={vehicles} costPerMile={1.28} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Every job has to recover more than its own distance <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One week, six vehicles
        </div>
      </CardFooter>
    </Card>
  )
}
