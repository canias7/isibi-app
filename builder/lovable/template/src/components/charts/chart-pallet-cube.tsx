import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PalletCube } from "@/components/charts/lib/warehouse"
const configs = [
  { name: "Case A · 400×300×220", cartonMm: [400, 300, 220] as [number, number, number], perLayer: 10, layers: 7 },
  { name: "Case B · 600×400×260", cartonMm: [600, 400, 260] as [number, number, number], perLayer: 5, layers: 6 },
  { name: "Case C · 300×200×180", cartonMm: [300, 200, 180] as [number, number, number], perLayer: 20, layers: 8 },
  { name: "Case D · 500×330×300", cartonMm: [500, 330, 300] as [number, number, number], perLayer: 7, layers: 5 },
]
const pallet = { widthMm: 1200, depthMm: 1000, maxHeightMm: 1800, deckMm: 150 }
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pallet cube</CardTitle>
        <CardDescription>Footprint times height, split apart</CardDescription>
      </CardHeader>
      <CardContent>
        <PalletCube configs={configs} pallet={pallet} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Freight is billed on the pallet either way <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          1200×1000 mm, 1800 mm high
        </div>
      </CardFooter>
    </Card>
  )
}
