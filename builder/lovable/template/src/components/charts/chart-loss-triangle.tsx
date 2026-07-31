import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LossTriangle } from "@/components/charts/lib/insure"
const years = [2019, 2020, 2021, 2022, 2023, 2024]
const rows = [
  [4200, 6900, 8100, 8700, 8950, 9020],
  [4600, 7400, 8700, 9350, 9600],
  [5100, 8200, 9600, 10300],
  [5400, 8800, 10400],
  [5900, 9600],
  [6300],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Claims development</CardTitle>
        <CardDescription>Accident year against development</CardDescription>
      </CardHeader>
      <CardContent>
        <LossTriangle years={years} rows={rows} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Factors computed from the triangle <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Paid, cumulative
        </div>
      </CardFooter>
    </Card>
  )
}
