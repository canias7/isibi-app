import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AngelShare } from "@/components/charts/lib/spirits"
const warehouses = [
  { name: "Dunnage, coastal", volumeLossPerYear: 0.021, abvChangePerYear: -0.42 },
  { name: "Racked, inland", volumeLossPerYear: 0.026, abvChangePerYear: 0.18 },
  { name: "Palletised, modern", volumeLossPerYear: 0.019, abvChangePerYear: 0.06 },
  { name: "Kentucky rickhouse", volumeLossPerYear: 0.044, abvChangePerYear: 0.55 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Angel's share</CardTitle>
        <CardDescription>Litres of pure alcohol, which is what is lost</CardDescription>
      </CardHeader>
      <CardContent>
        <AngelShare warehouses={warehouses} years={18} fillLitres={200} fillAbv={63.5} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two per cent a year is not two per cent <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          18 years in cask
        </div>
      </CardFooter>
    </Card>
  )
}
