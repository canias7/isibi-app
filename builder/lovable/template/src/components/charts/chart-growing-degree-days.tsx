import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GrowingDegreeDays } from "@/components/charts/lib/agri"
const MONTH = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"]
const days = Array.from({ length: 168 }, (_, i) => {
  const warm = 9 + Math.sin(((i - 20) / 168) * Math.PI) * 12
  return { date: `${MONTH[Math.floor(i / 28)]} ${(i % 28) + 1}`, tMin: Number((warm - 5).toFixed(1)), tMax: Number((warm + 7).toFixed(1)) }
})
const stages = [
  { name: "Emergence", gdd: 120 }, { name: "Tillering", gdd: 420 },
  { name: "Flowering", gdd: 900 }, { name: "Harvest", gdd: 1500 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Heat units accumulated</CardTitle>
        <CardDescription>Against the crop's stages</CardDescription>
      </CardHeader>
      <CardContent>
        <GrowingDegreeDays days={days} base={10} stages={stages} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Dates come from the accumulation <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Base 10°C
        </div>
      </CardFooter>
    </Card>
  )
}
