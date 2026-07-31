import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ClayShrinkage } from "@/components/charts/lib/ceramics"
const bodies = [
  { name: "White stoneware", dryMm: 94.2, firedMm: 88.4, absorptionPercent: 1.4 },
  { name: "Porcelain", dryMm: 93.1, firedMm: 86.2, absorptionPercent: 0.2 },
  { name: "Red earthenware", dryMm: 93.8, firedMm: 91.1, absorptionPercent: 9.6 },
  { name: "Crank", dryMm: 96.1, firedMm: 92.8, absorptionPercent: 4.2 },
  { name: "Black stoneware", dryMm: 94.6, firedMm: 89.3, absorptionPercent: 2.1 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Shrinkage bars</CardTitle>
        <CardDescription>Drying and firing, measured separately</CardDescription>
      </CardHeader>
      <CardContent>
        <ClayShrinkage bodies={bodies} markMm={100} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A mould is cut to the total, not the firing half <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          100 mm test mark
        </div>
      </CardFooter>
    </Card>
  )
}
