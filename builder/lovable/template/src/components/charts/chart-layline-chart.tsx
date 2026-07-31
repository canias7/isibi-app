import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LaylineChart } from "@/components/charts/lib/sailing"
const offsets = [
  { name: "On the layline", overstandDeg: 0 },
  { name: "Two degrees over", overstandDeg: 2 },
  { name: "Five degrees over", overstandDeg: 5 },
  { name: "Ten degrees over", overstandDeg: 10 },
  { name: "Twenty over", overstandDeg: 20 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Overstanding</CardTitle>
        <CardDescription>Trigonometry nobody does while steering</CardDescription>
      </CardHeader>
      <CardContent>
        <LaylineChart distanceNm={4} tackAngle={80} offsets={offsets} boatSpeedKn={6.2} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The boat that tacks last on the layline wins the beat <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          4 nm beat, 80° tacking
        </div>
      </CardFooter>
    </Card>
  )
}
