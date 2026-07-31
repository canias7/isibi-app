import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EnergyLabel } from "@/components/charts/lib/finance2"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Efficiency rating</CardTitle>
        <CardDescription>The A–G ladder</CardDescription>
      </CardHeader>
      <CardContent>
        <EnergyLabel grade="C" value={182} unit="kWh/yr" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Length as well as shade carries the rank <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Annual consumption
        </div>
      </CardFooter>
    </Card>
  )
}
