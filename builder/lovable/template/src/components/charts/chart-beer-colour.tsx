import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BeerColour } from "@/components/charts/lib/brewing"
const grains = [
  { name: "Maris Otter", kilograms: 4.8, lovibond: 2.5 },
  { name: "Munich", kilograms: 0.6, lovibond: 10 },
  { name: "Crystal 60", kilograms: 0.35, lovibond: 60 },
  { name: "Chocolate malt", kilograms: 0.12, lovibond: 350 },
  { name: "Roasted barley", kilograms: 0.06, lovibond: 500 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Colour</CardTitle>
        <CardDescription>SRM computed from the grain bill by Morey</CardDescription>
      </CardHeader>
      <CardContent>
        <BeerColour grains={grains} batchLitres={21} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two hundred grams of dark malt is 65% of it <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          21 L batch
        </div>
      </CardFooter>
    </Card>
  )
}
