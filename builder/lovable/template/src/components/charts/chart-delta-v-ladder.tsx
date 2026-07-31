import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DeltaVLadder } from "@/components/charts/lib/aero"
const legs = [
  { from: "Surface", to: "Low orbit", dv: 9400 },
  { from: "Low orbit", to: "Transfer", dv: 3200 },
  { from: "Transfer", to: "Capture", dv: 900 },
  { from: "Capture", to: "Low Mars orbit", dv: 1400 },
  { from: "Low Mars orbit", to: "Surface", dv: 4100 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Getting to orbit and beyond</CardTitle>
        <CardDescription>The cost of each burn</CardDescription>
      </CardHeader>
      <CardContent>
        <DeltaVLadder legs={legs} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Running total is what closes a mission <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Chemical propulsion
        </div>
      </CardFooter>
    </Card>
  )
}
