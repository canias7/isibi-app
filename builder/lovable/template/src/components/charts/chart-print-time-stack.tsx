import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PrintTimeStack } from "@/components/charts/lib/additive"
const builds = [
  { name: "Brackets ×64, flat", layers: 780, exposureMin: 412, recoatSecPerLayer: 11, warmUpMin: 95, coolMin: 140 },
  { name: "Brackets ×64, upright", layers: 2840, exposureMin: 438, recoatSecPerLayer: 11, warmUpMin: 95, coolMin: 180 },
  { name: "Manifold ×6", layers: 3120, exposureMin: 1140, recoatSecPerLayer: 11, warmUpMin: 95, coolMin: 210 },
  { name: "Impellers ×18", layers: 1640, exposureMin: 620, recoatSecPerLayer: 11, warmUpMin: 95, coolMin: 165 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Build time</CardTitle>
        <CardDescription>Where the hours actually go</CardDescription>
      </CardHeader>
      <CardContent>
        <PrintTimeStack builds={builds} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Recoating scales with height, not with the number of parts <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Four builds
        </div>
      </CardFooter>
    </Card>
  )
}
