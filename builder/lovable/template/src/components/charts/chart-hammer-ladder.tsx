import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HammerLadder } from "@/components/charts/lib/auction"
const lots = [
  { name: "Pair famille rose vases", hammer: 82000 },
  { name: "Rolex Datejust, 1978", hammer: 49000 },
  { name: "Oil, coastal, signed", hammer: 21500 },
  { name: "Longcase clock, Tompion school", hammer: 14000 },
  { name: "Persian rug, Kashan", hammer: 9400 },
  { name: "18c walnut bureau", hammer: 5800 },
  { name: "Silver tea service", hammer: 4100 },
  { name: "Bronze, after Barye", hammer: 3200 },
  { name: "Georgian mahogany table", hammer: 2400 },
  { name: "Victorian mourning ring", hammer: 1600 },
  { name: "Art deco cabinet", hammer: 1100 },
  { name: "Set of six dining chairs", hammer: 780 },
  { name: "Copper coal scuttle", hammer: 340 },
  { name: "Box of assorted plated ware", hammer: 180 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>The ladder</CardTitle>
        <CardDescription>Where a sale total actually sits</CardDescription>
      </CardHeader>
      <CardContent>
        <HammerLadder lots={lots} costPerLot={64} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The tail is not free and it is not small <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One sale, 41 lots
        </div>
      </CardFooter>
    </Card>
  )
}
