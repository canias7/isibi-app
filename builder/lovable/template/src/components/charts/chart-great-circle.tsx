import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GreatCircle } from "@/components/charts/lib/carto"
const routes = [
  { from: { lon: -0.45, lat: 51.47, label: "LHR" }, to: { lon: -118.4, lat: 33.94, label: "LAX" } },
  { from: { lon: -0.45, lat: 51.47, label: "LHR" }, to: { lon: 103.99, lat: 1.36, label: "SIN" }, dash: true },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Long-haul routes</CardTitle>
        <CardDescription>The shortest path is not the straight one</CardDescription>
      </CardHeader>
      <CardContent>
        <GreatCircle routes={routes} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Curves are the real flight paths <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Great-circle distance
        </div>
      </CardFooter>
    </Card>
  )
}
