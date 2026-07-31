import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LoanTurnover } from "@/components/charts/lib/libraries"
const titles = [
  { name: "Prize-winning novel", copies: 14, loans: 218, holds: 42 },
  { name: "Cookery, celebrity", copies: 9, loans: 186, holds: 6 },
  { name: "Local history", copies: 2, loans: 41, holds: 1 },
  { name: "Children's series #4", copies: 6, loans: 164, holds: 21 },
  { name: "Business paperback", copies: 4, loans: 22, holds: 0 },
  { name: "Crime, new author", copies: 3, loans: 78, holds: 14 },
  { name: "GCSE revision guide", copies: 8, loans: 96, holds: 2 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock turn</CardTitle>
        <CardDescription>Loans per copy, not per title</CardDescription>
      </CardHeader>
      <CardContent>
        <LoanTurnover titles={titles} months={12} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A loans ranking and a buying decision are different lists <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Twelve months
        </div>
      </CardFooter>
    </Card>
  )
}
