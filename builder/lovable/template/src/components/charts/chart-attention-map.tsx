import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AttentionMap } from "@/components/charts/lib/mldata"
const sourceTokens = ["the", "barber", "cut", "my", "hair", "yesterday"]
const targetTokens = ["le", "coiffeur", "m'a", "coupé", "les", "cheveux"]
const weights = [
  [0.72, 0.14, 0.03, 0.04, 0.03, 0.04],
  [0.11, 0.68, 0.06, 0.05, 0.05, 0.05],
  [0.05, 0.09, 0.24, 0.44, 0.11, 0.07],
  [0.04, 0.06, 0.66, 0.09, 0.09, 0.06],
  [0.06, 0.05, 0.05, 0.18, 0.58, 0.08],
  [0.04, 0.05, 0.06, 0.14, 0.62, 0.09],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Attention weights</CardTitle>
        <CardDescription>Each output token against the input</CardDescription>
      </CardHeader>
      <CardContent>
        <AttentionMap sourceTokens={sourceTokens} targetTokens={targetTokens} weights={weights} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Rows normalised, so a long row is not diluted <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One head
        </div>
      </CardFooter>
    </Card>
  )
}
