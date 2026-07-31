import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { QuoteConversion } from "@/components/charts/lib/fieldservice"
const ageBands = [
  { label: "Under a week", quoted: 86, won: 54, value: 74000 },
  { label: "One to two weeks", quoted: 71, won: 31, value: 61000 },
  { label: "Two to four weeks", quoted: 64, won: 14, value: 58000 },
  { label: "One to two months", quoted: 92, won: 11, value: 84000 },
  { label: "Over two months", quoted: 118, won: 6, value: 96000 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quotes</CardTitle>
        <CardDescription>A pipeline total counts March like yesterday</CardDescription>
      </CardHeader>
      <CardContent>
        <QuoteConversion ageBands={ageBands} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Conversion falls off a cliff and the total hides it <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Open quotes
        </div>
      </CardFooter>
    </Card>
  )
}
