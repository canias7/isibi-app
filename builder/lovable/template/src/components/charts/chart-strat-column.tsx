import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StratColumn } from "@/components/charts/lib/craft"
const beds = [
  { name: "Mudstone", metres: 9, grain: 0.08, fossils: "ammonites" },
  { name: "Siltstone", metres: 6, grain: 0.24 },
  { name: "Fine sandstone", metres: 7, grain: 0.46, fossils: "burrows" },
  { name: "Medium sandstone", metres: 8, grain: 0.66 },
  { name: "Coarse sandstone", metres: 7, grain: 0.84, fossils: "wood" },
  { name: "Conglomerate", metres: 5, grain: 1 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stratigraphic log</CardTitle>
        <CardDescription>Oldest at the base</CardDescription>
      </CardHeader>
      <CardContent>
        <StratColumn beds={beds} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The profile edge is the grain size <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          42 m logged
        </div>
      </CardFooter>
    </Card>
  )
}
