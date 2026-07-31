import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MareyGraph } from "@/components/charts/lib/strategy"
const stations = [
  { name: "Central", km: 0 },
  { name: "Riverside", km: 8 },
  { name: "Fell Rise", km: 19 },
  { name: "Kilnbrook", km: 31 },
  { name: "Harbour", km: 42 },
]
const NAMES = ["Central", "Riverside", "Fell Rise", "Kilnbrook", "Harbour"]
const down = [0, 20, 40].map((offset) => ({
  calls: NAMES.map((station, i) => ({ station, minutes: 420 + offset + i * 11 })),
}))
const fast = [{
  calls: [
    { station: "Central", minutes: 430 },
    { station: "Fell Rise", minutes: 448 },
    { station: "Harbour", minutes: 470 },
  ],
}]
const up = [10, 35].map((offset) => ({
  dash: true,
  calls: [...NAMES].reverse().map((station, i) => ({ station, minutes: 420 + offset + i * 12 })),
}))
const services = [...down, ...fast, ...up]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Train graph</CardTitle>
        <CardDescription>Distance up, time across</CardDescription>
      </CardHeader>
      <CardContent>
        <MareyGraph stations={stations} services={services} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A crossing is two trains passing <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Morning peak
        </div>
      </CardFooter>
    </Card>
  )
}
