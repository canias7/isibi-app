import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ColourStock } from "@/components/charts/lib/salon"
const shades = [
  { name: "6N natural dark blonde", onHand: 3, usedPerWeek: 2.4, costPerTube: 6.8 },
  { name: "7.1 ash blonde", onHand: 4, usedPerWeek: 3.1, costPerTube: 6.8 },
  { name: "9% developer", onHand: 9, usedPerWeek: 4.2, costPerTube: 4.2 },
  { name: "5.35 chocolate", onHand: 7, usedPerWeek: 1.6, costPerTube: 7.1 },
  { name: "Bleach powder 500g", onHand: 6, usedPerWeek: 1.1, costPerTube: 18.5 },
  { name: "Toner pearl", onHand: 11, usedPerWeek: 0.9, costPerTube: 8.4 },
  { name: "4.6 red mahogany", onHand: 8, usedPerWeek: 0, costPerTube: 7.1 },
  { name: "10.2 lightest pearl", onHand: 5, usedPerWeek: 0, costPerTube: 7.4 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Colour stock</CardTitle>
        <CardDescription>Weeks of cover, not tubes on a shelf</CardDescription>
      </CardHeader>
      <CardContent>
        <ColourStock shades={shades} orderLeadWeeks={2} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          No usage is dead stock, not infinite cover <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Two-week order lead
        </div>
      </CardFooter>
    </Card>
  )
}
