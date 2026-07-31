import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SunStudy } from "@/components/charts/lib/realestate"
const plot = (peak: number, shadeDepth: number) =>
  Array.from({ length: 14 }, (_, r) =>
    Array.from({ length: 14 }, (_, c) =>
      Number(Math.max(0, peak - shadeDepth * Math.exp(-(((c - 3) ** 2) / 26 + ((r - 11) ** 2) / 40))).toFixed(2)),
    ),
  )
const seasons = [
  { name: "Jun", grid: plot(9.2, 3.4) },
  { name: "Mar", grid: plot(6.1, 4.2) },
  { name: "Dec", grid: plot(2.9, 2.6) },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sun across the plot</CardTitle>
        <CardDescription>By season</CardDescription>
      </CardHeader>
      <CardContent>
        <SunStudy seasons={seasons} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Winter is the binding case <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Direct hours
        </div>
      </CardFooter>
    </Card>
  )
}
