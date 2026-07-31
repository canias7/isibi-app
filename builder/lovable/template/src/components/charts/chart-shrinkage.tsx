import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Shrinkage } from "@/components/charts/lib/textile"
const samples = [
  { name: "Sanforized", warp: [-1.2, -0.4, -0.2, -0.1, -0.1], weft: [-0.6, -0.2, -0.1, 0, -0.1] },
  { name: "Untreated", warp: [-3.4, -1.8, -0.9, -0.4, -0.2], weft: [-1.9, -0.9, -0.4, -0.2, -0.1] },
  { name: "Mercerised", warp: [-0.8, -0.3, -0.1, -0.1, 0], weft: [-0.4, -0.2, -0.1, 0, 0] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Shrinkage</CardTitle>
        <CardDescription>Residual change after each wash</CardDescription>
      </CardHeader>
      <CardContent>
        <Shrinkage samples={samples} tolerance={3} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          It is the total after it stabilises that matters <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          ±3% tolerance
        </div>
      </CardFooter>
    </Card>
  )
}
