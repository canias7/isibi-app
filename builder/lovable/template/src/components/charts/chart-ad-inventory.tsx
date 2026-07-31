import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AdInventory } from "@/components/charts/lib/podcast"
const slots = [
  { name: "Pre-roll", newEpisodes: 184000, backCatalogue: 226000, sold: 342000 },
  { name: "Mid-roll 1", newEpisodes: 168000, backCatalogue: 198000, sold: 268000 },
  { name: "Mid-roll 2", newEpisodes: 121000, backCatalogue: 142000, sold: 118000 },
  { name: "Post-roll", newEpisodes: 96000, backCatalogue: 114000, sold: 41000 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ad inventory</CardTitle>
        <CardDescription>The back catalogue keeps producing it</CardDescription>
      </CardHeader>
      <CardContent>
        <AdInventory slots={slots} cpm={24} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A rate card built on week one prices half the stock <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Monthly
        </div>
      </CardFooter>
    </Card>
  )
}
