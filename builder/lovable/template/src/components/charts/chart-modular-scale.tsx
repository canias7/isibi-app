import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ModularScale } from "@/components/charts/lib/typography"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Modular scale</CardTitle>
        <CardDescription>Every size generated from one ratio</CardDescription>
      </CardHeader>
      <CardContent>
        <ModularScale basePx={16} ratio={1.333} stepsUp={5} stepsDown={2} gridPx={4} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Snapping to the grid is where a ratio stops <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Perfect fourth
        </div>
      </CardFooter>
    </Card>
  )
}
