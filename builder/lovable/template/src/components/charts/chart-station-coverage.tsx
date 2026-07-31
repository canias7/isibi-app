import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StationCoverage } from "@/components/charts/lib/emergency"
let s = 733
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const stations = ["Central", "North", "East", "Riverside"]
const areas = Array.from({ length: 34 }, (_, i) => ({
  name: `Area ${i + 1}`,
  population: 1200 + Math.round(Math.pow(rnd(), 1.6) * 14000),
  minutesFrom: stations.map(() => Math.round((3 + Math.pow(rnd(), 0.9) * 17) * 10) / 10),
}))
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Station coverage</CardTitle>
        <CardDescription>Who can only be reached from here</CardDescription>
      </CardHeader>
      <CardContent>
        <StationCoverage areas={areas} stations={stations} standardMin={8} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A closure is argued on workload and decided by the hole <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Eight-minute standard
        </div>
      </CardFooter>
    </Card>
  )
}
