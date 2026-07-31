import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { VanStock } from "@/components/charts/lib/fieldservice"
const parts = [
  { name: "Diverter valve cartridge", carried: 1, neededPerMonth: 4, unitCost: 34 },
  { name: "Expansion vessel", carried: 0, neededPerMonth: 3, unitCost: 48 },
  { name: "PCB, common model", carried: 1, neededPerMonth: 2, unitCost: 186 },
  { name: "Pump head", carried: 2, neededPerMonth: 3, unitCost: 92 },
  { name: "Thermistor", carried: 6, neededPerMonth: 5, unitCost: 11 },
  { name: "Pressure sensor", carried: 4, neededPerMonth: 4, unitCost: 19 },
  { name: "Gasket set", carried: 14, neededPerMonth: 3, unitCost: 6 },
  { name: "Fan assembly", carried: 3, neededPerMonth: 1, unitCost: 141 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Van stock</CardTitle>
        <CardDescription>Capital against first-time fixes</CardDescription>
      </CardHeader>
      <CardContent>
        <VanStock parts={parts} revisitCost={128} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Stock is bought in capital and paid back in revisits <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Per van, per month
        </div>
      </CardFooter>
    </Card>
  )
}
