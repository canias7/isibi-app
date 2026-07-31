import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { OeeWaterfall } from "@/components/charts/lib/mfg"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Overall equipment effectiveness</CardTitle>
        <CardDescription>The three losses that produce it</CardDescription>
      </CardHeader>
      <CardContent>
        <OeeWaterfall
          plannedMinutes={480}
          downtimeMinutes={62}
          idealRate={1.4}
          actualUnits={472}
          goodUnits={451}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          OEE is the product of its own factors <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One shift, line 3
        </div>
      </CardFooter>
    </Card>
  )
}
