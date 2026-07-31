import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PhaseDiagram } from "@/components/charts/lib/chem"
const fusion = [
  { t: 216, p: 5.2 },
  { t: 222, p: 40 },
  { t: 228, p: 90 },
]
const vaporisation = [
  { t: 216, p: 5.2 },
  { t: 240, p: 12 },
  { t: 260, p: 24 },
  { t: 280, p: 42 },
  { t: 304, p: 73 },
]
const sublimation = [
  { t: 180, p: 0.4 },
  { t: 200, p: 2 },
  { t: 216, p: 5.2 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Phase diagram</CardTitle>
        <CardDescription>Pressure against temperature</CardDescription>
      </CardHeader>
      <CardContent>
        <PhaseDiagram
          fusion={fusion}
          vaporisation={vaporisation}
          sublimation={sublimation}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Both marked points sit on the curves <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Carbon dioxide, schematic
        </div>
      </CardFooter>
    </Card>
  )
}
