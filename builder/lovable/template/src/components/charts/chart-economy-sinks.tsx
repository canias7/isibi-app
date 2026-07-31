import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EconomySinks } from "@/components/charts/lib/gamedev"
const faucets = [
  { name: "Quest rewards", amount: 4_200_000 }, { name: "Mob drops", amount: 3_100_000 },
  { name: "Daily login", amount: 900_000 }, { name: "Selling to vendors", amount: 2_400_000 },
]
const sinks = [
  { name: "Repairs", amount: 2_800_000 }, { name: "Auction fees", amount: 1_600_000 },
  { name: "Fast travel", amount: 700_000 }, { name: "Crafting", amount: 2_100_000 },
  { name: "Cosmetics", amount: 1_900_000 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Faucets against sinks</CardTitle>
        <CardDescription>Currency created and destroyed</CardDescription>
      </CardHeader>
      <CardContent>
        <EconomySinks faucets={faucets} sinks={sinks} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Net decides whether prices rise <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Per day
        </div>
      </CardFooter>
    </Card>
  )
}
