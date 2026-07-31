import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DispensingMargin } from "@/components/charts/lib/vet"
const items = [
  { name: "Flea and worm spot-on", itemsDispensed: 1240, unitCost: 4.1, unitPrice: 9.8 },
  { name: "NSAID, liquid", itemsDispensed: 386, unitCost: 12.4, unitPrice: 27.5 },
  { name: "Antibiotic tablets", itemsDispensed: 512, unitCost: 3.2, unitPrice: 8.4 },
  { name: "Thyroid tablets", itemsDispensed: 148, unitCost: 21.6, unitPrice: 41.2 },
  { name: "Cardiac tablets", itemsDispensed: 96, unitCost: 48.5, unitPrice: 82 },
  { name: "Ear drops", itemsDispensed: 274, unitCost: 6.8, unitPrice: 16.4 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dispensing</CardTitle>
        <CardDescription>The fee has nothing to do with the price</CardDescription>
      </CardHeader>
      <CardContent>
        <DispensingMargin items={items} dispensingFee={12.5} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Everybody argues about the markup <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One quarter
        </div>
      </CardFooter>
    </Card>
  )
}
