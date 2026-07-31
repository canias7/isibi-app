import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EstimateAccuracy } from "@/components/charts/lib/auction"
const lots = [
  { name: "18c walnut bureau", lowEstimate: 800, highEstimate: 1200, hammer: 1450 },
  { name: "Pair famille rose vases", lowEstimate: 3000, highEstimate: 5000, hammer: 8200 },
  { name: "Victorian mourning ring", lowEstimate: 300, highEstimate: 500, hammer: 620 },
  { name: "Oil, harbour scene", lowEstimate: 1500, highEstimate: 2500, hammer: 1900 },
  { name: "Silver tea service", lowEstimate: 600, highEstimate: 900, hammer: 1150 },
  { name: "Longcase clock", lowEstimate: 2000, highEstimate: 3000, hammer: null },
  { name: "Art deco cocktail cabinet", lowEstimate: 400, highEstimate: 600, hammer: 340 },
  { name: "Rolex Datejust, 1978", lowEstimate: 2500, highEstimate: 3500, hammer: 4900 },
  { name: "Persian rug, Kashan", lowEstimate: 1200, highEstimate: 1800, hammer: 1650 },
  { name: "Bronze, after Barye", lowEstimate: 700, highEstimate: 1000, hammer: 1320 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Estimates</CardTitle>
        <CardDescription>Where the hammer landed on the range</CardDescription>
      </CardHeader>
      <CardContent>
        <EstimateAccuracy lots={lots} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Imprecise is a wider range; biased is a habit <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One sale
        </div>
      </CardFooter>
    </Card>
  )
}
