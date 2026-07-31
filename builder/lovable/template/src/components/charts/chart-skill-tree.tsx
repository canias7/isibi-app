import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SkillTree } from "@/components/charts/lib/gamedev"
const skills = [
  { id: "a", name: "Footwork", cost: 1, taken: true },
  { id: "b", name: "Guard", cost: 1, taken: true },
  { id: "c", name: "Riposte", cost: 2, taken: true, requires: ["a"] },
  { id: "d", name: "Parry", cost: 2, requires: ["b"] },
  { id: "e", name: "Counter", cost: 3, requires: ["c", "d"] },
  { id: "f", name: "Perfect guard", cost: 5, requires: ["e"] },
]
const tiers = [["a", "b"], ["c", "d"], ["e"], ["f"]]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Talent tree</CardTitle>
        <CardDescription>Full path cost, not node cost</CardDescription>
      </CardHeader>
      <CardContent>
        <SkillTree skills={skills} tiers={tiers} budget={12} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The bottom node costs more than it says <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One branch
        </div>
      </CardFooter>
    </Card>
  )
}
