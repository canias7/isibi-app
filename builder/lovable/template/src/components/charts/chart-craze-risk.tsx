import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CrazeRisk } from "@/components/charts/lib/ceramics"
const pairs = [
  { name: "Studio clear on white stoneware", glaze: 6.8, body: 6.5 },
  { name: "Studio clear on porcelain", glaze: 6.8, body: 5.4 },
  { name: "Satin white on crank", glaze: 5.9, body: 6.9 },
  { name: "Celadon on porcelain", glaze: 5.7, body: 5.4 },
  { name: "Matt liner on red earthenware", glaze: 8.1, body: 7.2 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Glaze fit</CardTitle>
        <CardDescription>Expansion mismatch, with its sign</CardDescription>
      </CardHeader>
      <CardContent>
        <CrazeRisk pairs={pairs} toleranceppm={0.5} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Shivering and crazing are one problem with a sign <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          ×10⁻⁶ per °C
        </div>
      </CardFooter>
    </Card>
  )
}
