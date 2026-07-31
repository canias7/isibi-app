import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TmLeverage } from "@/components/charts/lib/translation"
const bands = [
  { name: "Repetitions", words: 18400, rateShare: 0.15 },
  { name: "100% match", words: 42600, rateShare: 0.2 },
  { name: "95-99%", words: 12800, rateShare: 0.4 },
  { name: "85-94%", words: 9600, rateShare: 0.6 },
  { name: "75-84%", words: 7100, rateShare: 0.8 },
  { name: "New", words: 21300, rateShare: 1 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Memory leverage</CardTitle>
        <CardDescription>Word bands against what they cost</CardDescription>
      </CardHeader>
      <CardContent>
        <TmLeverage bands={bands} ratePerWord={0.14} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Leverage improves fastest by writing less source <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One release
        </div>
      </CardFooter>
    </Card>
  )
}
