import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CreditMigration } from "@/components/charts/lib/finance3"
const grades = ["AAA", "AA", "A", "BBB", "BB", "B", "D"]
const matrix = [
  [90.8, 8.3, 0.7, 0.1, 0.1, 0, 0],
  [0.7, 90.7, 7.8, 0.6, 0.1, 0.1, 0],
  [0.1, 2.3, 91.1, 5.5, 0.7, 0.2, 0.1],
  [0, 0.3, 5.9, 87.5, 5, 1.1, 0.2],
  [0, 0.1, 0.4, 7.7, 81.2, 8.4, 2.2],
  [0, 0.1, 0.2, 0.5, 6.5, 83.5, 9.2],
  [0, 0, 0, 0, 0, 0, 100],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rating migration</CardTitle>
        <CardDescription>One-year transition matrix</CardDescription>
      </CardHeader>
      <CardContent>
        <CreditMigration grades={grades} matrix={matrix} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          BB is the least stable grade <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Corporate issuers
        </div>
      </CardFooter>
    </Card>
  )
}
