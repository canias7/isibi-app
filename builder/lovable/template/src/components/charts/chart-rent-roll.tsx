import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RentRoll } from "@/components/charts/lib/realestate"
const tenancies = [
  { tenant: "Northwind Legal", sqm: 1240, annualRent: 496000, yearsLeft: 8 },
  { tenant: "Kiln Software", sqm: 620, annualRent: 254000, yearsLeft: 3 },
  { tenant: "Harbour Accountants", sqm: 410, annualRent: 168000, yearsLeft: 6 },
  { tenant: "Fell Design", sqm: 280, annualRent: 106000, yearsLeft: 2 },
  { tenant: "Ground floor café", sqm: 140, annualRent: 62000, yearsLeft: 11 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Income by tenancy</CardTitle>
        <CardDescription>Rent, rate and term</CardDescription>
      </CardHeader>
      <CardContent>
        <RentRoll tenancies={tenancies} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Concentration is the risk, not the total <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One building
        </div>
      </CardFooter>
    </Card>
  )
}
