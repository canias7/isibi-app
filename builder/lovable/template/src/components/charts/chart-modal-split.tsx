import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ModalSplit } from "@/components/charts/lib/transit2"
const modes = [
  { name: "Car driver", current: 41200, target: 30 },
  { name: "Bus", current: 12800, target: 22 },
  { name: "Rail", current: 9400, target: 14 },
  { name: "Cycle", current: 6100, target: 16 },
  { name: "Walk", current: 14300, target: 18 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mode share</CardTitle>
        <CardDescription>Trips today against the 2030 target</CardDescription>
      </CardHeader>
      <CardContent>
        <ModalSplit modes={modes} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Nineteen points must move out of the car <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          All-day trips
        </div>
      </CardFooter>
    </Card>
  )
}
