import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LaneRate } from "@/components/charts/lib/freight"
const lanes = [
  // the two long trunk lanes are already priced as a round trip, which is what
  // the outbound rate covering the return leg means — the other four are not
  { name: "Daventry → Glasgow", miles: 310, contractRate: 845, spotRate: 780, backloadRate: 340 },
  { name: "Felixstowe → Birmingham", miles: 165, contractRate: 340, spotRate: 395, backloadRate: 260 },
  { name: "Bristol → Leeds", miles: 210, contractRate: 415, spotRate: 430, backloadRate: 300 },
  { name: "Dover → Manchester", miles: 285, contractRate: 760, spotRate: 690, backloadRate: 180 },
  { name: "Southampton → Cardiff", miles: 130, contractRate: 290, spotRate: 285, backloadRate: 210 },
  { name: "Immingham → Milton Keynes", miles: 180, contractRate: 355, spotRate: 460 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lane rates</CardTitle>
        <CardDescription>Priced one way, run both ways</CardDescription>
      </CardHeader>
      <CardContent>
        <LaneRate lanes={lanes} costPerMile={1.28} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The backload is the trade, not the rate <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Contract review
        </div>
      </CardFooter>
    </Card>
  )
}
