import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FabricWeight } from "@/components/charts/lib/textile"
const fabrics = [
  { name: "Poplin 40s", endsPerCm: 52, picksPerCm: 28, warpTex: 14, weftTex: 14, statedGsm: 118 },
  { name: "Oxford", endsPerCm: 40, picksPerCm: 24, warpTex: 18, weftTex: 30, statedGsm: 152 },
  { name: "12 oz denim", endsPerCm: 30, picksPerCm: 20, warpTex: 72, weftTex: 84, statedGsm: 406 },
  { name: "Cotton twill", endsPerCm: 34, picksPerCm: 24, warpTex: 30, weftTex: 36, statedGsm: 250 },
  { name: "Voile", endsPerCm: 28, picksPerCm: 24, warpTex: 12, weftTex: 13, statedGsm: 68 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fabric weight</CardTitle>
        <CardDescription>GSM computed from the construction</CardDescription>
      </CardHeader>
      <CardContent>
        <FabricWeight fabrics={fabrics} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One spec sheet cannot produce its own number <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Five cloths
        </div>
      </CardFooter>
    </Card>
  )
}
