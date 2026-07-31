import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BycatchRatio } from "@/components/charts/lib/fisheries"
const tows = [
  { name: "Tow 1 · Smith Bank", targetKg: 1840, bycatchKg: 210, discardedKg: 84 },
  { name: "Tow 2 · Smith Bank", targetKg: 2260, bycatchKg: 188, discardedKg: 61 },
  { name: "Tow 3 · Long Forties", targetKg: 640, bycatchKg: 312, discardedKg: 240 },
  { name: "Tow 4 · Long Forties", targetKg: 980, bycatchKg: 176, discardedKg: 92 },
  { name: "Tow 5 · Fladen", targetKg: 3120, bycatchKg: 264, discardedKg: 78 },
  { name: "Tow 6 · Fladen", targetKg: 1410, bycatchKg: 402, discardedKg: 288 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bycatch</CardTitle>
        <CardDescription>Per kilo landed, not per tow</CardDescription>
      </CardHeader>
      <CardContent>
        <BycatchRatio tows={tows} limit={0.15} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The biggest tow is not the dirtiest one <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Observed trip
        </div>
      </CardFooter>
    </Card>
  )
}
