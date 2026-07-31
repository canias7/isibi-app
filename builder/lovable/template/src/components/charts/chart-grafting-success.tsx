import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GraftingSuccess } from "@/components/charts/lib/horticulture"
const rootstocks = ["M9", "M26", "MM106", "Seedling"]
const methods = ["Whip and tongue", "Cleft", "Chip bud", "Omega"]
const attempted = [
  [60, 60, 60, 60], [60, 60, 60, 60], [60, 60, 60, 60], [60, 60, 60, 60],
]
const taken = [
  [48, 41, 52, 44], [45, 38, 49, 40], [51, 44, 33, 47], [39, 34, 42, 36],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Graft take</CardTitle>
        <CardDescription>Rootstock against method, interaction visible</CardDescription>
      </CardHeader>
      <CardContent>
        <GraftingSuccess rootstocks={rootstocks} methods={methods} taken={taken} attempted={attempted} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One pairing beats both its factors <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Spring bench grafting
        </div>
      </CardFooter>
    </Card>
  )
}
