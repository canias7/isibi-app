import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DecayCurve } from "@/components/charts/lib/chem"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Radioactive decay</CardTitle>
        <CardDescription>Halving at a fixed interval</CardDescription>
      </CardHeader>
      <CardContent>
        <DecayCurve halfLife={5730} span={22000} unit="years" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Each dashed step is one half-life <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Carbon-14
        </div>
      </CardFooter>
    </Card>
  )
}
