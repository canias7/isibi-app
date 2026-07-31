import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Planogram } from "@/components/charts/lib/retail2"
const shelves = [
  { items: [{ sku: "Own label", facings: 4 }, { sku: "Value", facings: 3 }, { sku: "Bulk", facings: 2 }] },
  { items: [{ sku: "Hero brand", facings: 5 }, { sku: "Premium", facings: 3 }, { sku: "Seasonal", facings: 2 }] },
  { items: [{ sku: "Mid brand", facings: 3 }, { sku: "Own label", facings: 3 }, { sku: "New", facings: 2 }, { sku: "Trial", facings: 1 }] },
  { items: [{ sku: "Multipack", facings: 4 }, { sku: "Catering", facings: 4 }] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>The shelf as built</CardTitle>
        <CardDescription>Facings across, shelves down</CardDescription>
      </CardHeader>
      <CardContent>
        <Planogram shelves={shelves} eyeLevel={1} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Eye level sells what the others do not <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Bay 4
        </div>
      </CardFooter>
    </Card>
  )
}
