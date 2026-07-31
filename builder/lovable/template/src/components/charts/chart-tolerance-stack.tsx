import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ToleranceStack } from "@/components/charts/lib/civil"
const dimensions = [
  { name: "Base plate", nominal: 12, tolerance: 0.15 },
  { name: "Shim", nominal: 3, tolerance: 0.05 },
  { name: "Bearing", nominal: 28, tolerance: 0.2 },
  { name: "Spacer", nominal: 9.5, tolerance: 0.1 },
  { name: "Cap", nominal: 6, tolerance: 0.12 },
  { name: "Washer", nominal: 2.5, tolerance: 0.08 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tolerance stack</CardTitle>
        <CardDescription>Worst case against the statistical sum</CardDescription>
      </CardHeader>
      <CardContent>
        <ToleranceStack dimensions={dimensions} requirement={0.55} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Worst case fails, RSS passes <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Six-part assembly
        </div>
      </CardFooter>
    </Card>
  )
}
