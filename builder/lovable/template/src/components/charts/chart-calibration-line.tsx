import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CalibrationLine } from "@/components/charts/lib/chemlab"
const standards = [
  { concentration: 0, signal: 0.014 }, { concentration: 2, signal: 0.121 },
  { concentration: 4, signal: 0.238 }, { concentration: 6, signal: 0.349 },
  { concentration: 8, signal: 0.471 }, { concentration: 10, signal: 0.582 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Standards and an unknown</CardTitle>
        <CardDescription>Read back off the fit</CardDescription>
      </CardHeader>
      <CardContent>
        <CalibrationLine standards={standards} unknown={0.402} unit="mg/L" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Outside the range is extrapolation <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          UV absorbance
        </div>
      </CardFooter>
    </Card>
  )
}
