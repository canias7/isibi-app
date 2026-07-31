import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ProofAccounting } from "@/components/charts/lib/spirits"
const steps = [
  { name: "Off the still", litres: 620, abv: 68.4, note: "hearts only" },
  { name: "Into cask", litres: 612, abv: 63.5, note: "reduced with water" },
  { name: "Out of cask, 12 y", litres: 468, abv: 58.1, note: "angel's share" },
  { name: "Vatted", litres: 464, abv: 58.1, note: "racking loss" },
  { name: "Reduced to strength", litres: 604, abv: 43, note: "water added" },
  { name: "Filtered", litres: 598, abv: 43 },
  { name: "Bottled", litres: 591, abv: 43, note: "line loss" },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Proof accounting</CardTitle>
        <CardDescription>Every step is a subtraction from the return</CardDescription>
      </CardHeader>
      <CardContent>
        <ProofAccounting steps={steps} dutyPerLpa={31.64} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Duty is charged on alcohol, not on bottles <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One batch
        </div>
      </CardFooter>
    </Card>
  )
}
