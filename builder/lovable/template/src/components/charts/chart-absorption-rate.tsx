import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AbsorptionRate } from "@/components/charts/lib/realestate"
const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const months = M.map((label, i) => ({
  label,
  sold: Math.round(28 + Math.sin(i / 2) * 9 + i * 0.6),
  listed: Math.round(190 - i * 6 + Math.cos(i / 3) * 18),
}))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Months of supply</CardTitle>
        <CardDescription>Sold against what is listed</CardDescription>
      </CardHeader>
      <CardContent>
        <AbsorptionRate months={months} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Under four months is a sellers' market <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Twelve months
        </div>
      </CardFooter>
    </Card>
  )
}
