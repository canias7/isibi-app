import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PickPath } from "@/components/charts/lib/warehouse"
const picks = [
  { sku: "A-118", aisle: 2, positionM: 14 },
  { sku: "B-204", aisle: 7, positionM: 3 },
  { sku: "C-071", aisle: 1, positionM: 22 },
  { sku: "D-330", aisle: 5, positionM: 9 },
  { sku: "E-412", aisle: 8, positionM: 26 },
  { sku: "F-009", aisle: 0, positionM: 6 },
  { sku: "G-155", aisle: 6, positionM: 18 },
  { sku: "H-288", aisle: 3, positionM: 31 },
  { sku: "J-046", aisle: 4, positionM: 2 },
  { sku: "K-501", aisle: 8, positionM: 11 },
  { sku: "L-172", aisle: 1, positionM: 28 },
  { sku: "M-390", aisle: 6, positionM: 5 },
  { sku: "N-023", aisle: 3, positionM: 16 },
  { sku: "P-247", aisle: 7, positionM: 24 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pick path</CardTitle>
        <CardDescription>The order issued against the order that walks</CardDescription>
      </CardHeader>
      <CardContent>
        <PickPath aisles={9} picks={picks} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A pick list is ordered by nothing to do with the building <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          14 lines, 9 aisles
        </div>
      </CardFooter>
    </Card>
  )
}
