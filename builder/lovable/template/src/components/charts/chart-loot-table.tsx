import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LootTable } from "@/components/charts/lib/gamedev"
const drops = [
  { item: "Iron scrap", rate: 0.62, tier: "common" },
  { item: "Rune shard", rate: 0.24, tier: "uncommon" },
  { item: "Ember core", rate: 0.08, tier: "rare" },
  { item: "Warden's sigil", rate: 0.021, tier: "epic" },
  { item: "Ashen crown", rate: 0.005, tier: "legendary" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Drop rates</CardTitle>
        <CardDescription>And what they mean in attempts</CardDescription>
      </CardHeader>
      <CardContent>
        <LootTable drops={drops} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Half see it by that many tries <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One boss
        </div>
      </CardFooter>
    </Card>
  )
}
