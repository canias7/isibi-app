import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { NestingEfficiency } from "@/components/charts/lib/additive"
const nests = [
  { name: "Flat, single job", parts: [{ name: "Bracket", footprintMm2: 640, heightMm: 22, count: 72 }] },
  { name: "Flat, plus one riser", parts: [
    { name: "Bracket", footprintMm2: 640, heightMm: 22, count: 68 },
    { name: "Riser", footprintMm2: 900, heightMm: 190, count: 1 }] },
  { name: "Upright", parts: [{ name: "Bracket", footprintMm2: 190, heightMm: 96, count: 96 }] },
  { name: "Mixed batch", parts: [
    { name: "Bracket", footprintMm2: 640, heightMm: 22, count: 40 },
    { name: "Housing", footprintMm2: 2400, heightMm: 74, count: 8 },
    { name: "Impeller", footprintMm2: 1600, heightMm: 68, count: 6 }] },
]
const platform = { areaMm2: 62500, maxHeightMm: 325 }
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nesting</CardTitle>
        <CardDescription>Plate area against build volume</CardDescription>
      </CardHeader>
      <CardContent>
        <NestingEfficiency nests={nests} platform={platform} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One tall bracket makes every layer that tall <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          250×250×325 mm
        </div>
      </CardFooter>
    </Card>
  )
}
