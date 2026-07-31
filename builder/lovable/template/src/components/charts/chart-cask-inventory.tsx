import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CaskInventory } from "@/components/charts/lib/spirits"
const ages = [
  { year: 1, casks: 2400, lpaEach: 118 },
  { year: 3, casks: 2100, lpaEach: 112 },
  { year: 5, casks: 1800, lpaEach: 106 },
  { year: 8, casks: 1240, lpaEach: 98 },
  { year: 12, casks: 720, lpaEach: 88 },
  { year: 15, casks: 380, lpaEach: 82 },
  { year: 18, casks: 190, lpaEach: 76 },
  { year: 25, casks: 62, lpaEach: 66 },
]
const valuePerLpaByAge = [
  { year: 1, value: 14 }, { year: 3, value: 22 }, { year: 5, value: 34 },
  { year: 8, value: 58 }, { year: 12, value: 96 }, { year: 15, value: 128 },
  { year: 18, value: 152 }, { year: 25, value: 176 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Maturing stock</CardTitle>
        <CardDescription>What another year is worth against what it costs</CardDescription>
      </CardHeader>
      <CardContent>
        <CaskInventory ages={ages} valuePerLpaByAge={valuePerLpaByAge} storagePerCaskPerYear={9.4} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A stock report and a cash-flow problem on one line <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Warehouse total
        </div>
      </CardFooter>
    </Card>
  )
}
