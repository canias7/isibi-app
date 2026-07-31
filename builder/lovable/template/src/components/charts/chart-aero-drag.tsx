import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AeroDrag } from "@/components/charts/lib/cycling"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where the power goes</CardTitle>
        <CardDescription>Drag against rolling and gravity</CardDescription>
      </CardHeader>
      <CardContent>
        <AeroDrag cda={0.29} crr={0.004} massKg={78} gradient={0} maxKph={55} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Past the crossover, position beats weight <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Flat road
        </div>
      </CardFooter>
    </Card>
  )
}
