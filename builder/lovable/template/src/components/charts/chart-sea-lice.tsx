import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SeaLice } from "@/components/charts/lib/aquaculture"
const pens = ["Pen 1", "Pen 2", "Pen 3", "Pen 4", "Pen 5", "Pen 6"]
const weeks = ["w18", "w19", "w20", "w21", "w22", "w23", "w24", "w25"]
const counts = [
  [0.12, 0.18, 0.26, 0.34, 0.44, 0.58, 0.71, 0.42],
  [0.08, 0.11, 0.16, 0.22, 0.31, 0.39, 0.48, 0.29],
  [0.21, 0.38, 0.61, 0.94, 1.42, 1.88, 2.24, 1.11],
  [0.09, 0.14, 0.19, 0.24, 0.33, 0.41, 0.52, 0.31],
  [0.15, 0.24, 0.36, 0.49, 0.66, 0.84, 1.02, 0.58],
  [0.06, 0.09, 0.12, 0.17, 0.23, 0.29, 0.36, 0.22],
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sea lice</CardTitle>
        <CardDescription>The trigger is a site number</CardDescription>
      </CardHeader>
      <CardContent>
        <SeaLice pens={pens} weeks={weeks} counts={counts} trigger={0.5} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Treating the site averages a problem that belongs to one net <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Adult females per fish
        </div>
      </CardFooter>
    </Card>
  )
}
