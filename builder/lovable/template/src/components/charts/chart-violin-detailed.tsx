import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ViolinPlot, sampleViolins } from "./lib/violin"

const violins = sampleViolins(["Cuts", "Colour", "Beard", "Towel"], 15)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Violin</CardTitle>
        <CardDescription>A narrow kernel — more detail, more noise.</CardDescription>
      </CardHeader>
      <CardContent>
        <ViolinPlot violins={violins} bandwidth={3} steps={80} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Colour splits into two groups <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
