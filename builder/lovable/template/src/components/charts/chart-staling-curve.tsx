import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StalingCurve } from "@/components/charts/lib/bakery"
const products = [
  { name: "Sourdough", statedDays: 3, firmness: [
    { day: 0, n: 2.1 }, { day: 1, n: 3.4 }, { day: 2, n: 5.2 }, { day: 3, n: 7.6 }, { day: 4, n: 10.4 }, { day: 5, n: 12.9 }] },
  { name: "Tin loaf", statedDays: 5, firmness: [
    { day: 0, n: 1.6 }, { day: 1, n: 3.1 }, { day: 2, n: 5.4 }, { day: 3, n: 8.2 }, { day: 4, n: 11.1 }, { day: 5, n: 13.6 }] },
  { name: "Rye", statedDays: 6, firmness: [
    { day: 0, n: 3.2 }, { day: 1, n: 3.9 }, { day: 2, n: 4.8 }, { day: 3, n: 5.9 }, { day: 4, n: 7.1 }, { day: 5, n: 8.4 }] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Staling</CardTitle>
        <CardDescription>Crumb firmness against saleable</CardDescription>
      </CardHeader>
      <CardContent>
        <StalingCurve products={products} saleableFirmness={9} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One printed date is past what the crumb does <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Measured, not printed
        </div>
      </CardFooter>
    </Card>
  )
}
