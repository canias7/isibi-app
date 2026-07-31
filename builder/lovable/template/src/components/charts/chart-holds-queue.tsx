import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HoldsQueue } from "@/components/charts/lib/libraries"
const titles = [
  { name: "Prize-winning novel", copies: 14, holds: 128, onOrder: 6 },
  { name: "Children's series #4", copies: 6, holds: 41 },
  { name: "Crime, new author", copies: 3, holds: 38, onOrder: 4 },
  { name: "Memoir, broadcast tie-in", copies: 5, holds: 96, onOrder: 10 },
  { name: "Cookery, celebrity", copies: 9, holds: 22 },
  { name: "Health paperback", copies: 2, holds: 19 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Holds</CardTitle>
        <CardDescription>The wait, derived from the queue</CardDescription>
      </CardHeader>
      <CardContent>
        <HoldsQueue titles={titles} loanWeeks={3} targetWeeks={8} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A borrower is asking for a date, not a number <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Three-week loans
        </div>
      </CardFooter>
    </Card>
  )
}
